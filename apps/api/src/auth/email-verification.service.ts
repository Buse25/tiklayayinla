import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual, randomInt } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { ResendVerificationDto, VerifyEmailDto, VerificationActionResponseDto, VerificationRequiredResponseDto, VerificationStatusResponseDto } from './dto/verification.dto';

type VerificationTarget = {
  userId: string;
  email: string;
};

type EmailVerificationCodeRecord = Prisma.EmailVerificationCodeGetPayload<{ include: { user: true } }>;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly hashSecret = requiredEnv('JWT_ACCESS_SECRET');
  private readonly contextSecret = requiredEnv('JWT_ACCESS_SECRET');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
  ) {}

  async createAndSendCode(userId: string, email: string): Promise<VerificationRequiredResponseDto> {
    const target = { userId, email: normalizeEmail(email) };
    const verificationContext = await this.createVerificationContext(target);
    const code = generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const resendAvailableAt = new Date(Date.now() + 60_000);
    const now = new Date();

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: { userId: target.userId, email: target.email, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      return tx.emailVerificationCode.create({
        data: {
          userId: target.userId,
          email: target.email,
          codeHash,
          expiresAt,
          resendAvailableAt,
          sentAt: now,
        },
      });
    });

    let mailDeliveryFailed = false;
    try {
      await this.mailService.sendVerificationCode({ to: target.email, code, expiresAt, resendAvailableAt });
      await this.audit.log({
        actorUserId: target.userId,
        action: AuditAction.EMAIL_VERIFICATION_CODE_SENT,
        entityType: AuditEntityType.USER,
        entityId: target.userId,
        changes: { email: maskEmail(target.email), expiresAt: expiresAt.toISOString(), resendAvailableAt: resendAvailableAt.toISOString() },
      });
    } catch (error) {
      mailDeliveryFailed = true;
      await this.prisma.emailVerificationCode.updateMany({
        where: { id: record.id, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
      await this.audit.log({
        actorUserId: target.userId,
        action: AuditAction.MAIL_DELIVERY_FAILED,
        entityType: AuditEntityType.USER,
        entityId: target.userId,
        changes: { email: maskEmail(target.email), reason: 'verification-code', error: serializeError(error) },
      });
      this.logger.warn({ event: 'verification_mail_delivery_failed', userId: target.userId, email: maskEmail(target.email) });
    }

    return {
      verificationRequired: true,
      email: maskEmail(target.email),
      expiresAt,
      resendAvailableAt,
      verificationContext,
      mailDeliveryFailed,
    };
  }

  async verifyCode(input: VerifyEmailDto): Promise<VerificationTarget> {
    const target = await this.resolveTarget(input);
    const user = await this.prisma.user.findUnique({ where: { id: target.userId } });
    if (!user) throw new UnauthorizedException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama kodu geçersiz.' });
    if (user.emailVerified) throw new ConflictException({ code: 'EMAIL_ALREADY_VERIFIED', message: 'E-posta adresi zaten doğrulanmış.' });

    const codeHistory = await this.findCodeHistory(target.email);
    const latestCode = codeHistory[0] ?? null;
    if (!latestCode) throw new UnauthorizedException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama kodu geçersiz.' });

    const now = new Date();
    const providedHash = this.hashCode(input.code);
    const matchingCode = codeHistory.find((record) => safeCompare(record.codeHash, providedHash)) ?? null;

    if (!matchingCode) {
      const activeCode = codeHistory.find((record) => !record.consumedAt && !record.invalidatedAt) ?? null;
      if (!activeCode) {
        await this.audit.log({
          actorUserId: target.userId,
          action: AuditAction.EMAIL_VERIFICATION_FAILED,
          entityType: AuditEntityType.USER,
          entityId: target.userId,
          changes: { email: maskEmail(target.email), reason: 'no_active_code' },
        });
        throw new UnauthorizedException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama kodu geçersiz.' });
      }
      if (activeCode.attemptCount >= activeCode.maxAttempts) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'EMAIL_VERIFICATION_RESEND_COOLDOWN',
          message: 'Yeni doğrulama kodu istemeden önce biraz beklemelisiniz.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
      }
      const attemptCount = activeCode.attemptCount + 1;
      const invalidatedAt = attemptCount >= activeCode.maxAttempts ? new Date() : null;
      await this.prisma.emailVerificationCode.update({
        where: { id: activeCode.id },
        data: { attemptCount, ...(invalidatedAt ? { invalidatedAt } : {}) },
      });
      await this.audit.log({
        actorUserId: target.userId,
        action: AuditAction.EMAIL_VERIFICATION_FAILED,
        entityType: AuditEntityType.USER,
        entityId: target.userId,
        changes: { email: maskEmail(target.email), reason: invalidatedAt ? 'attempts_exceeded' : 'invalid_code', attemptCount, maxAttempts: activeCode.maxAttempts },
      });
      if (invalidatedAt) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'EMAIL_VERIFICATION_RESEND_COOLDOWN',
          message: 'Yeni doğrulama kodu istemeden önce biraz beklemelisiniz.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
      }
      throw new UnauthorizedException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama kodu geçersiz.' });
    }

    if (matchingCode.consumedAt) throw new ConflictException({ code: 'EMAIL_VERIFICATION_CODE_USED', message: 'Doğrulama kodu daha önce kullanıldı.' });
    if (matchingCode.invalidatedAt) throw new UnauthorizedException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama kodu geçersiz.' });
    if (matchingCode.expiresAt <= now) {
      await this.markCodeFailed(matchingCode.id, target.userId, target.email, 'expired');
      throw new ConflictException({ code: 'EMAIL_VERIFICATION_CODE_EXPIRED', message: 'Doğrulama kodunun süresi doldu.' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: { userId: target.userId, email: target.email, consumedAt: null },
        data: { invalidatedAt: new Date() },
      });
      await tx.emailVerificationCode.update({
        where: { id: matchingCode.id },
        data: { consumedAt: new Date(), invalidatedAt: null },
      });
      await tx.user.update({
        where: { id: target.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });
    });

    await this.audit.log({
      actorUserId: target.userId,
      action: AuditAction.EMAIL_VERIFICATION_SUCCEEDED,
      entityType: AuditEntityType.USER,
      entityId: target.userId,
      changes: { email: maskEmail(target.email) },
    });

    return target;
  }

  async resendCode(input: ResendVerificationDto): Promise<VerificationActionResponseDto> {
    const target = await this.resolveTarget(input);
    const user = await this.prisma.user.findUnique({ where: { id: target.userId } });
    if (!user) return { accepted: true, expiresAt: null, resendAvailableAt: null, verificationContext: undefined, mailDeliveryFailed: false };
    if (user.emailVerified) throw new ConflictException({ code: 'EMAIL_ALREADY_VERIFIED', message: 'E-posta adresi zaten doğrulanmış.' });

    const latestCode = await this.findLatestCode(target.email);
    const now = new Date();
    if (latestCode && latestCode.resendAvailableAt > now) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'EMAIL_VERIFICATION_RESEND_COOLDOWN',
          message: 'Yeni doğrulama kodu istemeden önce biraz beklemelisiniz.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.createAndSendCode(target.userId, target.email);
    await this.audit.log({
      actorUserId: target.userId,
      action: AuditAction.EMAIL_VERIFICATION_RESENT,
      entityType: AuditEntityType.USER,
      entityId: target.userId,
changes: {
  email: maskEmail(target.email),
  resendAvailableAt: result.resendAvailableAt?.toISOString() ?? null,
},
    });
    return {
      accepted: true,
      expiresAt: result.expiresAt,
      resendAvailableAt: result.resendAvailableAt,
      verificationContext: result.verificationContext,
      mailDeliveryFailed: result.mailDeliveryFailed,
    };
  }

  async getStatus(input: Pick<VerifyEmailDto, 'email' | 'verificationContext'>): Promise<VerificationStatusResponseDto> {
    const target = await this.resolveTarget(input);
    const user = await this.prisma.user.findUnique({ where: { id: target.userId } });
    if (!user) {
      return { emailVerified: false, expiresAt: null, resendAvailableAt: null, attemptsRemaining: 0, verificationContext: undefined };
    }
    if (user.emailVerified) {
      return { emailVerified: true, expiresAt: null, resendAvailableAt: null, attemptsRemaining: 0, verificationContext: await this.createVerificationContext(target) };
    }
    const latestCode = await this.findLatestCode(target.email);
    const attemptsRemaining = latestCode ? Math.max(0, latestCode.maxAttempts - latestCode.attemptCount) : 0;
    return {
      emailVerified: false,
      expiresAt: latestCode?.consumedAt || latestCode?.invalidatedAt ? null : latestCode?.expiresAt ?? null,
      resendAvailableAt: latestCode?.resendAvailableAt ?? null,
      attemptsRemaining,
      verificationContext: await this.createVerificationContext(target),
    };
  }

  private async resolveTarget(input: Pick<VerifyEmailDto, 'email' | 'verificationContext'>): Promise<VerificationTarget> {
    if (input.verificationContext) {
      let payload: VerificationContextPayload;
      try {
        payload = await this.jwt.verifyAsync<VerificationContextPayload>(input.verificationContext, { secret: this.contextSecret });
      } catch {
        throw new BadRequestException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama bilgisi geçersiz.' });
      }
      if (payload.purpose !== 'email-verification' || !payload.sub || !payload.email) {
        throw new BadRequestException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama bilgisi geçersiz.' });
      }
      if (input.email && normalizeEmail(input.email) !== normalizeEmail(payload.email)) {
        throw new BadRequestException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama bilgisi geçersiz.' });
      }
      return { userId: payload.sub, email: normalizeEmail(payload.email) };
    }

    if (!input.email) {
      throw new BadRequestException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama bilgisi geçersiz.' });
    }
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) {
      throw new BadRequestException({ code: 'EMAIL_VERIFICATION_CODE_INVALID', message: 'Doğrulama bilgisi geçersiz.' });
    }
    return { userId: user.id, email: user.email };
  }

  private async createVerificationContext(target: VerificationTarget): Promise<string> {
    return this.jwt.signAsync(
      { sub: target.userId, email: target.email, purpose: 'email-verification' },
      { secret: this.contextSecret, expiresIn: '1d' },
    );
  }

  private async findLatestCode(email: string): Promise<EmailVerificationCodeRecord | null> {
    return this.prisma.emailVerificationCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  private async findCodeHistory(email: string): Promise<EmailVerificationCodeRecord[]> {
    return this.prisma.emailVerificationCode.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  private async markCodeFailed(codeId: string, userId: string, email: string, reason: string): Promise<void> {
    await this.prisma.emailVerificationCode.update({ where: { id: codeId }, data: { invalidatedAt: new Date() } });
    await this.audit.log({
      actorUserId: userId,
      action: AuditAction.EMAIL_VERIFICATION_FAILED,
      entityType: AuditEntityType.USER,
      entityId: userId,
      changes: { email: maskEmail(email), reason },
    });
  }

  private hashCode(code: string): string {
    return createHmac('sha256', this.hashSecret).update(code).digest('hex');
  }

}

type VerificationContextPayload = {
  sub: string;
  email: string;
  purpose: 'email-verification';
};

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function maskEmail(email: string): string {
  const [localPart, domain = ''] = email.split('@');
  const maskedLocal = localPart.length <= 2 ? `${localPart[0] ?? '*'}*` : `${localPart[0]}***${localPart.at(-1)}`;
  const [host, ...rest] = domain.split('.');
  const maskedHost = host.length <= 2 ? `${host[0] ?? '*'}*` : `${host[0]}***${host.at(-1)}`;
  return `${maskedLocal}@${[maskedHost, ...rest].filter(Boolean).join('.')}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable must be set.`);
  return value;
}

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 120);
  return String(error).slice(0, 120);
}
