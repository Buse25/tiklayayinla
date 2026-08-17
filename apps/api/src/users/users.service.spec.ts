import { AuditAction, EidsIdentityStatus, EidsVerificationMethod, PhoneVerificationMethod, UserRole } from '@prisma/client';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-id',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '+905551112233',
    phoneVerifiedAt: null,
    phoneVerificationMethod: null,
    emailVerified: true,
    emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
    about: null,
    address: null,
    role: UserRole.USER,
    status: 'ACTIVE',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    organizationMemberships: [],
    ...overrides,
  };
}

function setup() {
  const tx = {
    user: {
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    phoneVerificationCode: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    user: { findUniqueOrThrow: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    organizationApplication: { findFirst: jest.fn().mockResolvedValue(null) },
    subscription: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const mail = {};
  const eids = { getIdentityStatus: jest.fn().mockResolvedValue({ configured: false, status: 'NOT_VERIFIED', verified: false, verifiedAt: null }) };
  return { service: new UsersService(prisma as never, audit as never, mail as never, eids as never), prisma, tx, audit, eids };
}

describe('UsersService phone verification', () => {
  it('clears verification when the phone changes', async () => {
    const { service, tx } = setup();
    tx.user.findUniqueOrThrow.mockResolvedValue({ phone: '+905551112233' });
    tx.user.update.mockResolvedValue(profile({ phone: '+905551114455' }));

    await service.updateMyProfile('user-id', { phone: '+905551114455' });

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phone: '+905551114455', phoneVerifiedAt: null, phoneVerificationMethod: null }),
    }));
  });

  it('preserves verification when the phone is unchanged', async () => {
    const { service, tx } = setup();
    tx.user.findUniqueOrThrow.mockResolvedValue({ phone: '+905551112233' });
    tx.user.update.mockResolvedValue(profile({ phoneVerifiedAt: new Date(), phoneVerificationMethod: PhoneVerificationMethod.ADMIN }));

    await service.updateMyProfile('user-id', { phone: '+905551112233' });

    const update = tx.user.update.mock.calls[0][0];
    expect(update.data).toEqual({ phone: '+905551112233' });
  });

  it('rejects manual verification without a phone', async () => {
    const { service, tx, audit } = setup();
    tx.user.findUnique.mockResolvedValue({ phone: null });

    await expect(service.manuallyVerifyPhone('admin-id', UserRole.ADMIN, 'user-id')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('sets ADMIN method and writes an audit entry', async () => {
    const { service, tx, audit } = setup();
    tx.user.findUnique.mockResolvedValue({ phone: '+905551112233' });
    tx.user.update.mockResolvedValue(profile({ phoneVerifiedAt: new Date(), phoneVerificationMethod: PhoneVerificationMethod.ADMIN }));

    const result = await service.manuallyVerifyPhone('admin-id', UserRole.ADMIN, 'user-id');

    expect(result.phoneVerified).toBe(true);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { phoneVerifiedAt: expect.any(Date), phoneVerificationMethod: PhoneVerificationMethod.ADMIN },
    }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'admin-id', entityId: 'user-id', action: AuditAction.PHONE_VERIFICATION_ADMIN }));
  });

  it('rejects non-admin manual verification', async () => {
    const { service } = setup();

    await expect(service.manuallyVerifyPhone('user-id', UserRole.USER, 'target-id')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('derives phoneVerified in the profile response', async () => {
    const { service, prisma } = setup();
    const phoneVerifiedAt = new Date('2026-08-02T00:00:00.000Z');
    prisma.user.findUniqueOrThrow.mockResolvedValue(profile({ phoneVerifiedAt, phoneVerificationMethod: PhoneVerificationMethod.ADMIN }));

    const result = await service.getMyProfile('user-id');

    expect(result.phoneVerified).toBe(true);
    expect(result.phoneVerifiedAt).toEqual(phoneVerifiedAt);
    expect(result.phoneVerificationMethod).toBe(PhoneVerificationMethod.ADMIN);
    expect(result.emailVerified).toBe(true);
  });

  it('rejects non-admin user listing', async () => {
    const { service } = setup();
    await expect(service.listAdminUsers(UserRole.USER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists admin users without sensitive fields', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([{
      id: 'user-id', firstName: 'Test', lastName: 'User', email: 'user@example.com',
      emailVerified: true, emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'), phone: '+905551112233',
      phoneVerifiedAt: null, phoneVerificationMethod: null, role: UserRole.USER, status: 'ACTIVE',
      createdAt: new Date('2026-08-01T00:00:00.000Z'), organizationMemberships: [],
      organizationApplications: [{ status: 'PENDING' }],
      eidsIdentity: { status: EidsIdentityStatus.VERIFIED, verificationMethod: EidsVerificationMethod.EIDS, verifiedAt: new Date('2026-08-03T00:00:00.000Z') },
    }]);

    const result = await service.listAdminUsers(UserRole.ADMIN);

    expect(result[0]).toMatchObject({ id: 'user-id', email: 'user@example.com', phoneVerified: false, latestApplicationStatus: 'PENDING', eidsStatus: EidsIdentityStatus.VERIFIED, eidsVerificationMethod: EidsVerificationMethod.EIDS });
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).not.toHaveProperty('userCode');
  });

  it('returns an admin user detail and 404 for a missing user', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-id', firstName: 'Test', lastName: 'User', email: 'user@example.com',
      emailVerified: false, emailVerifiedAt: null, phone: null, phoneVerifiedAt: null,
      phoneVerificationMethod: null, role: UserRole.USER, status: 'ACTIVE',
      createdAt: new Date('2026-08-01T00:00:00.000Z'), organizationMemberships: [], organizationApplications: [],
    });
    await expect(service.getAdminUser(UserRole.ADMIN, 'user-id')).resolves.toMatchObject({ id: 'user-id', phoneVerified: false });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getAdminUser(UserRole.ADMIN, 'missing-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
