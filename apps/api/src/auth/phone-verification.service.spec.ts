import { ConflictException, HttpException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PhoneVerificationMethod } from '@prisma/client';
import { PhoneVerificationService } from './phone-verification.service';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-long-enough';

function setup(overrides: Record<string, unknown> = {}) {
  const tx = {
    phoneVerificationCode: { updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { update: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ phone: '+905551112233' }) },
    phoneVerificationCode: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    ...overrides,
  };
  const sms = { sendVerificationCode: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new PhoneVerificationService(prisma as never, sms as never, audit as never), prisma, tx, sms, audit };
}

describe('PhoneVerificationService', () => {
  it('rejects missing or invalid phone numbers', async () => {
    const missing = setup({ user: { findUnique: jest.fn().mockResolvedValue({ phone: null }) } });
    await expect(missing.service.requestCode('user-id')).rejects.toBeInstanceOf(ConflictException);
    const invalid = setup({ user: { findUnique: jest.fn().mockResolvedValue({ phone: '123' }) } });
    await expect(invalid.service.requestCode('user-id')).rejects.toThrow('Geçerli');
  });

  it('does not leave an active code when the provider is unavailable', async () => {
    const state = setup();
    state.sms.sendVerificationCode.mockRejectedValue(new ServiceUnavailableException('SMS provider yapılandırılmamış.'));
    state.prisma.phoneVerificationCode.findFirst.mockResolvedValue(null);
    state.tx.phoneVerificationCode.create.mockResolvedValue({ id: 'code-id' });
    await expect(state.service.requestCode('user-id')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(state.prisma.phoneVerificationCode.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'code-id' }, data: { invalidatedAt: expect.any(Date) } }));
  });

  it('stores only a hash and enforces resend cooldown', async () => {
    const state = setup();
    state.prisma.phoneVerificationCode.findFirst.mockResolvedValue(null);
    state.tx.phoneVerificationCode.create.mockResolvedValue({ id: 'code-id' });
    await state.service.requestCode('user-id');
    const create = state.tx.phoneVerificationCode.create.mock.calls[0][0];
    expect(create.data.codeHash).not.toMatch(/^\d{6}$/);
    expect(create.data).not.toHaveProperty('code');

    const cooldown = setup();
    cooldown.prisma.phoneVerificationCode.findFirst.mockResolvedValue({ resendAvailableAt: new Date(Date.now() + 30_000) });
    await expect(cooldown.service.requestCode('user-id')).rejects.toBeInstanceOf(HttpException);
  });

  it('verifies a code and changes an ADMIN verification to OTP', async () => {
    const state = setup();
    const code = '123456';
    const crypto = require('crypto') as typeof import('crypto');
    const hash = crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET!).update(code).digest('hex');
    state.prisma.user.findUnique.mockResolvedValue({ phone: '+905551112233' });
    state.prisma.phoneVerificationCode.findFirst.mockResolvedValue({ id: 'code-id', phone: '+905551112233', codeHash: hash, expiresAt: new Date(Date.now() + 60_000), attemptCount: 0, maxAttempts: 5, consumedAt: null, invalidatedAt: null });
    await state.service.verifyCode('user-id', { code });
    expect(state.tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { phone: '+905551112233', phoneVerifiedAt: expect.any(Date), phoneVerificationMethod: PhoneVerificationMethod.OTP } }));
  });

  it('increments wrong attempts and invalidates after the maximum', async () => {
    const state = setup();
    state.prisma.phoneVerificationCode.findFirst.mockResolvedValue({ id: 'code-id', codeHash: 'hash', expiresAt: new Date(Date.now() + 60_000), attemptCount: 4, maxAttempts: 5, consumedAt: null, invalidatedAt: null });
    await expect(state.service.verifyCode('user-id', { code: '000000' })).rejects.toBeInstanceOf(HttpException);
    expect(state.prisma.phoneVerificationCode.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attemptCount: 5, invalidatedAt: expect.any(Date) }) }));
  });

  it('rejects expired and consumed codes', async () => {
    const expired = setup();
    expired.prisma.phoneVerificationCode.findFirst.mockResolvedValue({ id: 'code-id', codeHash: 'hash', expiresAt: new Date(Date.now() - 1), attemptCount: 0, maxAttempts: 5 });
    await expect(expired.service.verifyCode('user-id', { code: '123456' })).rejects.toBeInstanceOf(ConflictException);
    const consumed = setup();
    consumed.prisma.phoneVerificationCode.findFirst.mockResolvedValue(null);
    await expect(consumed.service.verifyCode('user-id', { code: '123456' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
