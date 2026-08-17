import { ForbiddenException } from '@nestjs/common';
import { AuditAction, EidsIdentityStatus, EidsListingAuthorizationStatus, EidsVerificationMethod, ListingDomain } from '@prisma/client';
import { EidsListingAuthorizationService } from './eids-listing-authorization.service';

const user = { id: 'user-id', role: 'USER', organizationType: 'AUTO_DEALER', membershipStatus: 'ACTIVE', organizationApplicationStatus: null } as never;
const listing = { id: 'listing-id', ownerId: 'user-id', listingDomain: ListingDomain.VEHICLE, city: 'İstanbul', district: 'Kadıköy', neighborhood: 'Caferağa', address: 'Adres', vehicleDetails: { brand: 'Brand', model: 'Model', year: 2024, mileage: 1000 } };

function setup(overrides: Record<string, unknown> = {}) {
  const pending = { id: 'authorization-id', listingId: listing.id, userId: user.id, domain: listing.listingDomain, status: EidsListingAuthorizationStatus.PENDING, verificationMethod: null, externalReference: null, snapshot: null, validUntil: null, nextCheckAt: null, verifiedAt: null, revokedAt: null, failedAt: null, lastCheckedAt: new Date(), failureReason: null };
  const verified = { ...pending, status: EidsListingAuthorizationStatus.VERIFIED, verificationMethod: EidsVerificationMethod.EIDS, externalReference: 'external-id', verifiedAt: new Date() };
  const prisma = {
    listing: { findFirst: jest.fn().mockResolvedValue(listing) },
    eidsIdentity: { findUnique: jest.fn().mockResolvedValue({ userCode: 'user-code' }) },
    eidsListingAuthorization: {
      findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(pending),
      create: jest.fn().mockResolvedValue(pending),
      update: jest.fn().mockResolvedValue(verified),
    },
    ...overrides,
  };
  const eids = { getIdentityStatus: jest.fn().mockResolvedValue({ status: EidsIdentityStatus.VERIFIED, verificationMethod: EidsVerificationMethod.EIDS }) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const provider = { verifyProperty: jest.fn(), verifyVehicle: jest.fn().mockResolvedValue({ verificationMethod: EidsVerificationMethod.EIDS, externalReference: 'external-id' }) };
  const config = { get: jest.fn().mockReturnValue(false) };
  return { service: new EidsListingAuthorizationService(prisma as never, eids as never, audit as never, config as never, provider as never), prisma, eids, audit, provider, pending, verified };
}

describe('EidsListingAuthorizationService', () => {
  it('verifies a vehicle through the vehicle provider and persists VERIFIED', async () => {
    const { service, provider, prisma, audit } = setup();
    const result = await service.startAuthorization(user, listing.id);
    expect(provider.verifyVehicle).toHaveBeenCalledWith(expect.objectContaining({ domain: ListingDomain.VEHICLE, userCode: 'user-code' }));
    expect(provider.verifyProperty).not.toHaveBeenCalled();
    expect(prisma.eidsListingAuthorization.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: EidsListingAuthorizationStatus.VERIFIED, verificationMethod: EidsVerificationMethod.EIDS }) }));
    expect(result.status).toBe(EidsListingAuthorizationStatus.VERIFIED);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.LISTING_EIDS_AUTHORIZATION_VERIFIED }));
  });

  it.each([
    EidsListingAuthorizationStatus.NOT_VERIFIED,
    EidsListingAuthorizationStatus.PENDING,
    EidsListingAuthorizationStatus.FAILED,
    EidsListingAuthorizationStatus.EXPIRED,
    EidsListingAuthorizationStatus.REVOKED,
  ])('blocks publish when authorization is %s', async (status) => {
    const authorization = { id: 'authorization-id', listingId: listing.id, userId: user.id, domain: ListingDomain.VEHICLE, status, verificationMethod: EidsVerificationMethod.EIDS, validUntil: null };
    const { service, audit } = setup({ eidsListingAuthorization: { findUnique: jest.fn().mockResolvedValue(authorization), update: jest.fn().mockResolvedValue({ ...authorization, status: EidsListingAuthorizationStatus.EXPIRED }) } });
    await expect(service.assertPublishAllowed(user.id, listing.id, ListingDomain.VEHICLE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.LISTING_PUBLISH_BLOCKED_BY_EIDS }));
  });

  it('expires a verified authorization when validUntil is in the past', async () => {
    const authorization = { id: 'authorization-id', listingId: listing.id, userId: user.id, domain: ListingDomain.VEHICLE, status: EidsListingAuthorizationStatus.VERIFIED, verificationMethod: EidsVerificationMethod.EIDS, validUntil: new Date(Date.now() - 1000) };
    const update = jest.fn().mockResolvedValue({ ...authorization, status: EidsListingAuthorizationStatus.EXPIRED });
    const { service } = setup({ eidsListingAuthorization: { findUnique: jest.fn().mockResolvedValue(authorization), update } });
    await expect(service.assertPublishAllowed(user.id, listing.id, ListingDomain.VEHICLE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: EidsListingAuthorizationStatus.EXPIRED }) }));
  });

  it('allows FAILED authorization to retry through PENDING', async () => {
    const failed = { id: 'authorization-id', listingId: listing.id, userId: user.id, domain: ListingDomain.VEHICLE, status: EidsListingAuthorizationStatus.FAILED, verificationMethod: null, validUntil: null };
    const { service, prisma } = setup({ eidsListingAuthorization: { findUnique: jest.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce({ ...failed, status: EidsListingAuthorizationStatus.PENDING }).mockResolvedValueOnce({ ...failed, status: EidsListingAuthorizationStatus.PENDING }), update: jest.fn().mockResolvedValue({ ...failed, status: EidsListingAuthorizationStatus.PENDING }), create: jest.fn() } });
    await service.startAuthorization(user, listing.id);
    expect(prisma.eidsListingAuthorization.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: EidsListingAuthorizationStatus.PENDING }) }));
  });

  it('does not accept ADMIN_TEST unless explicitly enabled', async () => {
    const { service, eids } = setup();
    eids.getIdentityStatus.mockResolvedValue({ status: EidsIdentityStatus.VERIFIED, verificationMethod: EidsVerificationMethod.ADMIN_TEST });
    await expect(service.startAuthorization(user, listing.id)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
