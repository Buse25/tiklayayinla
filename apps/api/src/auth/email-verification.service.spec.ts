import { JwtService } from '@nestjs/jwt';
import { AuditAction } from '@prisma/client';
import { createHmac } from 'crypto';
import { EmailVerificationService } from './email-verification.service';
import type { MailService } from '../mail/mail.service';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('EmailVerificationService', () => {
  const hashSecret = 'test-access-secret-test-access-secret';

  let prisma: PrismaService;
  let mailService: MailService;
  let audit: AuditService;
  let jwt: JwtService;
  let service: EmailVerificationService;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = hashSecret;
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      emailVerificationCode: {
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma as unknown as never)),
    } as unknown as PrismaService;
    mailService = { sendVerificationCode: jest.fn(), sendOrganizationApplicationApproved: jest.fn(), sendOrganizationApplicationCreated: jest.fn(), sendOrganizationApplicationRejected: jest.fn(), sendTestMail: jest.fn(), verifyTransport: jest.fn(), sendMail: jest.fn() } as unknown as MailService;
    audit = { log: jest.fn() } as unknown as AuditService;
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() } as unknown as JwtService;
    service = new EmailVerificationService(prisma, mailService, audit, jwt);
  });

  it('creates and mails a verification code', async () => {
    (jwt.signAsync as jest.Mock).mockResolvedValue('verification-context');
    (prisma.emailVerificationCode.create as jest.Mock).mockResolvedValue({ id: 'code-id' });
    (mailService.sendVerificationCode as jest.Mock).mockResolvedValue({ messageId: 'mail-id' });

    const result = await service.createAndSendCode('user-id', 'user@example.com');

    expect(result.verificationRequired).toBe(true);
    expect(result.verificationContext).toBe('verification-context');
    expect(prisma.emailVerificationCode.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'user@example.com',
        codeHash: expect.any(String),
      }),
    }));
    expect(mailService.sendVerificationCode).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
    }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.EMAIL_VERIFICATION_CODE_SENT,
    }));
  });

  it('verifies a correct code', async () => {
    const codeHash = hmac('123456');
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-id', email: 'user@example.com', purpose: 'email-verification' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-id', emailVerified: false });
    (prisma.emailVerificationCode.findMany as jest.Mock).mockResolvedValue([{
      id: 'code-id',
      user: { id: 'user-id' },
      userId: 'user-id',
      email: 'user@example.com',
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      maxAttempts: 5,
      resendAvailableAt: new Date(Date.now() + 30_000),
      sentAt: new Date(),
      consumedAt: null,
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.verifyCode({ email: 'user@example.com', verificationContext: 'verification-context', code: '123456' });

    expect(result).toEqual({ userId: 'user-id', email: 'user@example.com' });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-id' },
      data: expect.objectContaining({ emailVerified: true }),
    }));
  });

  it('blocks resend during cooldown', async () => {
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-id', email: 'user@example.com', purpose: 'email-verification' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-id', emailVerified: false });
    (prisma.emailVerificationCode.findFirst as jest.Mock).mockResolvedValue({
      id: 'code-id',
      userId: 'user-id',
      email: 'user@example.com',
      codeHash: hmac('123456'),
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      maxAttempts: 5,
      resendAvailableAt: new Date(Date.now() + 60_000),
      sentAt: new Date(),
      consumedAt: null,
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: 'user-id' },
    });

    await expect(service.resendCode({ verificationContext: 'verification-context' })).rejects.toMatchObject({
      response: { code: 'EMAIL_VERIFICATION_RESEND_COOLDOWN' },
    });
  });
});

function hmac(code: string): string {
  return createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '').update(code).digest('hex');
}

