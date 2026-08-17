import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { EidsIdentityStatus, PhoneVerificationMethod } from '@prisma/client';
import { EidsClientError } from './eids.client';
import { EidsService } from './eids.service';

const userId = '11111111-1111-1111-1111-111111111111';
const validConfig = { EIDS_ENABLED: 'true', WEB_URL: 'https://web.test', EIDS_FIRMA_CODE: 'firma', EIDS_BASIC_AUTH_USERNAME: 'user', EIDS_BASIC_AUTH_PASSWORD: 'secret', EIDS_RETURN_URL: 'https://web.test/api/eids/callback', EIDS_SSO_BASE_URL: 'https://sso.test', EIDS_API_BASE_URL: 'https://api.test', EIDS_GET_USER_CODE_PATH: '/GetKullaniciKodu', EIDS_GET_USER_CODE_REQUEST_FIELD: 'yetkiKodu', EIDS_GET_USER_CODE_RESPONSE_FIELD: 'kullaniciKodu', EIDS_REQUEST_TIMEOUT_MS: 5000 };
function configFor(values: Record<string, unknown>) { return { get: jest.fn((key: string) => values[key]), getOrThrow: jest.fn((key: string) => values[key] ?? (() => { throw new Error(`missing ${key}`); })()) }; }
function audit() { return { log: jest.fn().mockResolvedValue(undefined) }; }
function client(overrides: Partial<{ getUserCode: jest.Mock }> = {}) { return { getUserCode: jest.fn().mockResolvedValue({ userCode: 'user-code' }), ...overrides }; }

describe('EidsService', () => {
  it('reports disabled and incomplete configuration as not configured', async () => {
    const prisma = { eidsIdentity: { findUnique: jest.fn().mockResolvedValue(null) } };
    const result = await new EidsService(prisma as never, configFor({}) as never, audit() as never, client() as never).getIdentityStatus('user-id');
    expect(result).toMatchObject({ configured: false, status: EidsIdentityStatus.NOT_VERIFIED });
  });

  it('rejects authorize when EIDS is disabled or configuration is incomplete', async () => {
    const prisma = { user: { findUnique: jest.fn() } };
    await expect(new EidsService(prisma as never, configFor({}) as never, audit() as never, client() as never).createAuthorizeSession(userId)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(new EidsService(prisma as never, configFor({ EIDS_ENABLED: 'true' }) as never, audit() as never, client() as never).createAuthorizeSession(userId)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([PhoneVerificationMethod.ADMIN, null])('rejects authorize when phone method is %s', async (method) => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ phone: '+905551112233', phoneVerifiedAt: new Date(), phoneVerificationMethod: method }) } };
    await expect(new EidsService(prisma as never, configFor(validConfig) as never, audit() as never, client() as never).createAuthorizeSession(userId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a phone number', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ phone: null, phoneVerifiedAt: null, phoneVerificationMethod: null }) } };
    await expect(new EidsService(prisma as never, configFor(validConfig) as never, audit() as never, client() as never).createAuthorizeSession(userId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates an OTP authorize session and marks identity pending', async () => {
    const tx = { eidsVerificationSession: { updateMany: jest.fn(), create: jest.fn() }, eidsIdentity: { upsert: jest.fn() } };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ phone: '+905551112233', phoneVerifiedAt: new Date(), phoneVerificationMethod: PhoneVerificationMethod.OTP }) }, $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const result = await new EidsService(prisma as never, configFor(validConfig) as never, audit() as never, client() as never).createAuthorizeSession(userId);
    expect(result.authorizeUrl).toBe('https://sso.test/oturum?firmaKodu=firma');
    expect(tx.eidsIdentity.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: EidsIdentityStatus.PENDING, verificationMethod: null }) }));
  });

  it('calls GetKullaniciKodu and marks identity verified on callback', async () => {
    const tx = { eidsIdentity: { upsert: jest.fn() }, eidsVerificationSession: { update: jest.fn() } };
    const prisma = {
      eidsVerificationSession: { findFirst: jest.fn().mockResolvedValue({ id: 'session-id', userId }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const eidsClient = client();
    const result = await new EidsService(prisma as never, configFor(validConfig) as never, audit() as never, eidsClient as never).handleCallback('token', 'one-time-code', '1');
    expect(result).toBe('success');
    expect(eidsClient.getUserCode).toHaveBeenCalledWith({ authorizationCode: 'one-time-code' });
    expect(tx.eidsIdentity.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: EidsIdentityStatus.VERIFIED, verificationMethod: 'EIDS', userCode: 'user-code' }) }));
  });

  it('fails callback without yetkiKodu and does not expose it in audit', async () => {
    const tx = { eidsIdentity: { upsert: jest.fn() }, eidsVerificationSession: { update: jest.fn() } };
    const auditMock = audit();
    const prisma = { eidsVerificationSession: { findFirst: jest.fn().mockResolvedValue({ id: 'session-id', userId }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const result = await new EidsService(prisma as never, configFor(validConfig) as never, auditMock as never, client() as never).handleCallback('token', undefined, '1');
    expect(result).toBe('failed');
    expect(JSON.stringify(auditMock.log.mock.calls)).not.toContain('yetkiKodu');
  });

  it('fails safely when GetKullaniciKodu fails', async () => {
    const tx = { eidsIdentity: { upsert: jest.fn() }, eidsVerificationSession: { update: jest.fn() } };
    const prisma = { eidsVerificationSession: { findFirst: jest.fn().mockResolvedValue({ id: 'session-id', userId }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const eidsClient = client({ getUserCode: jest.fn().mockRejectedValue(new EidsClientError('timeout')) });
    const result = await new EidsService(prisma as never, configFor(validConfig) as never, audit() as never, eidsClient as never).handleCallback('token', 'one-time-code', '1');
    expect(result).toBe('failed');
    expect(tx.eidsIdentity.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: EidsIdentityStatus.FAILED }) }));
  });

  it('does not allow a callback replay after the session is claimed', async () => {
    const prisma = { eidsVerificationSession: { findFirst: jest.fn().mockResolvedValue({ id: 'session-id', userId }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const eidsClient = client();
    const result = await new EidsService(prisma as never, configFor(validConfig) as never, audit() as never, eidsClient as never).handleCallback('token', 'one-time-code', '1');
    expect(result).toBe('failed');
    expect(eidsClient.getUserCode).not.toHaveBeenCalled();
  });
});
