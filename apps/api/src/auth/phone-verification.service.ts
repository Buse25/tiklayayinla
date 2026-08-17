import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { maskPhone, normalizePhone } from '../users/phone-normalization';
import { PhoneVerificationResponseDto, VerifyPhoneDto } from './dto/phone-verification.dto';

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PhoneVerificationService {
  private readonly hashSecret = requiredEnv('JWT_ACCESS_SECRET');

  constructor(private readonly prisma: PrismaService, private readonly sms: SmsService, private readonly audit: AuditService) {}

  async requestCode(userId: string): Promise<PhoneVerificationResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const phone = normalizePhone(user?.phone);
    if (!phone) throw new ConflictException('OTP doğrulaması için önce geçerli bir telefon numarası ekleyin.');

    const now = new Date();
    const latest = await this.prisma.phoneVerificationCode.findFirst({ where: { userId, phone, consumedAt: null, invalidatedAt: null }, orderBy: { createdAt: 'desc' }, select: { resendAvailableAt: true } });
    if (latest && latest.resendAvailableAt > now) throw new HttpException({ statusCode: 429, code: 'PHONE_VERIFICATION_RESEND_COOLDOWN', message: 'Yeni SMS kodu istemeden önce biraz beklemelisiniz.' }, HttpStatus.TOO_MANY_REQUESTS);

    const code = generateCode();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.phoneVerificationCode.updateMany({ where: { userId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
      return tx.phoneVerificationCode.create({ data: { userId, phone, codeHash: this.hashCode(code), expiresAt, resendAvailableAt, sentAt: now, maxAttempts: MAX_ATTEMPTS } });
    });

    try {
      await this.sms.sendVerificationCode(phone, code, expiresAt);
    } catch (error) {
      await this.prisma.phoneVerificationCode.update({ where: { id: record.id }, data: { invalidatedAt: new Date() } });
      await this.audit.log({ actorUserId: userId, action: AuditAction.PHONE_OTP_FAILED, entityType: AuditEntityType.USER, entityId: userId, changes: { reason: 'provider_unavailable' } });
      throw error;
    }

    await this.audit.log({ actorUserId: userId, action: AuditAction.PHONE_OTP_REQUESTED, entityType: AuditEntityType.USER, entityId: userId, changes: { phone: maskPhone(phone), expiresAt: expiresAt.toISOString(), resendAvailableAt: resendAvailableAt.toISOString() } });
    return { accepted: true, phone: maskPhone(phone), expiresAt, resendAvailableAt };
  }

  async verifyCode(userId: string, input: VerifyPhoneDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const phone = normalizePhone(user?.phone);
    if (!phone) throw new ConflictException('OTP doğrulaması için geçerli bir telefon numarası gerekir.');
    const active = await this.prisma.phoneVerificationCode.findFirst({ where: { userId, phone, consumedAt: null, invalidatedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!active) throw new UnauthorizedException({ code: 'PHONE_VERIFICATION_CODE_INVALID', message: 'Doğrulama kodu geçersiz.' });
    const now = new Date();
    if (active.expiresAt <= now) {
      await this.invalidate(active.id);
      await this.auditFailure(userId, 'expired');
      throw new ConflictException({ code: 'PHONE_VERIFICATION_CODE_EXPIRED', message: 'Doğrulama kodunun süresi doldu.' });
    }
    if (active.attemptCount >= active.maxAttempts) {
      await this.invalidate(active.id);
      throw new HttpException({ statusCode: 429, code: 'PHONE_VERIFICATION_MAX_ATTEMPTS', message: 'Maksimum deneme sayısına ulaşıldı.' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const providedHash = this.hashCode(input.code);
    if (!safeCompare(active.codeHash, providedHash)) {
      const attemptCount = active.attemptCount + 1;
      const exhausted = attemptCount >= active.maxAttempts;
      await this.prisma.phoneVerificationCode.update({ where: { id: active.id }, data: { attemptCount, ...(exhausted ? { invalidatedAt: now } : {}) } });
      await this.auditFailure(userId, exhausted ? 'attempts_exceeded' : 'invalid_code');
      if (exhausted) await this.audit.log({ actorUserId: userId, action: AuditAction.PHONE_OTP_MAX_ATTEMPTS, entityType: AuditEntityType.USER, entityId: userId, changes: { maxAttempts: active.maxAttempts } });
      throw exhausted ? new HttpException({ statusCode: 429, code: 'PHONE_VERIFICATION_MAX_ATTEMPTS', message: 'Maksimum deneme sayısına ulaşıldı.' }, HttpStatus.TOO_MANY_REQUESTS) : new UnauthorizedException({ code: 'PHONE_VERIFICATION_CODE_INVALID', message: 'Doğrulama kodu geçersiz.' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.phoneVerificationCode.updateMany({ where: { userId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
      await tx.phoneVerificationCode.update({ where: { id: active.id }, data: { consumedAt: now, invalidatedAt: null } });
      await tx.user.update({ where: { id: userId }, data: { phone: phone, phoneVerifiedAt: now, phoneVerificationMethod: 'OTP' } });
    });
    await this.audit.log({ actorUserId: userId, action: AuditAction.PHONE_OTP_VERIFIED, entityType: AuditEntityType.USER, entityId: userId, changes: { phone: maskPhone(phone) } });
  }

  private hashCode(code: string): string { return createHmac('sha256', this.hashSecret).update(code).digest('hex'); }
  private async invalidate(id: string): Promise<void> { await this.prisma.phoneVerificationCode.update({ where: { id }, data: { invalidatedAt: new Date() } }); }
  private async auditFailure(userId: string, reason: string): Promise<void> { await this.audit.log({ actorUserId: userId, action: AuditAction.PHONE_OTP_FAILED, entityType: AuditEntityType.USER, entityId: userId, changes: { reason } }); }
}

function generateCode(): string { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }
function safeCompare(expected: string, actual: string): boolean { const left = Buffer.from(expected, 'utf8'); const right = Buffer.from(actual, 'utf8'); return left.length === right.length && timingSafeEqual(left, right); }
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`${name} must be set.`); return value; }
