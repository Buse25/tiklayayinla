import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditAction, AuditEntityType, EidsIdentityStatus, EidsListingAuthorizationStatus, EidsVerificationMethod, ListingDomain, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditService } from '../audit/audit.service';
import { EidsService } from './eids.service';
import { EIDS_LISTING_AUTHORIZATION_PROVIDER, type EidsListingAuthorizationInput, type EidsListingAuthorizationProvider, type EidsListingAuthorizationResult } from './eids-listing-authorization.provider';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const transitions: Record<EidsListingAuthorizationStatus, readonly EidsListingAuthorizationStatus[]> = {
  NOT_VERIFIED: [EidsListingAuthorizationStatus.PENDING],
  PENDING: [EidsListingAuthorizationStatus.VERIFIED, EidsListingAuthorizationStatus.FAILED],
  VERIFIED: [EidsListingAuthorizationStatus.EXPIRED, EidsListingAuthorizationStatus.REVOKED],
  FAILED: [EidsListingAuthorizationStatus.PENDING],
  EXPIRED: [EidsListingAuthorizationStatus.PENDING],
  REVOKED: [EidsListingAuthorizationStatus.PENDING],
};

@Injectable()
export class EidsListingAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eids: EidsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(EIDS_LISTING_AUTHORIZATION_PROVIDER) private readonly provider: EidsListingAuthorizationProvider,
  ) {}

  async startAuthorization(user: AuthenticatedUser, listingId: string) {
    const listing = await this.getOwnedListing(user.id, listingId);
    await this.assertVerifiedIdentity(user.id);
    let existing = await this.prisma.eidsListingAuthorization.findUnique({ where: { listingId } });
    if (existing?.status === EidsListingAuthorizationStatus.PENDING) throw new ConflictException('Bu ilan için EİDS yetkilendirmesi zaten devam ediyor.');
    if (existing?.status === EidsListingAuthorizationStatus.VERIFIED && !this.isExpired(existing.validUntil)) return this.toResponse(existing);
    if (existing?.status === EidsListingAuthorizationStatus.VERIFIED && this.isExpired(existing.validUntil)) {
      await this.markExpired(user.id, listingId);
      existing = { ...existing, status: EidsListingAuthorizationStatus.EXPIRED };
    }

    const pending = await this.transitionToPending(listing, existing);
    await this.audit.log({ actorUserId: user.id, action: AuditAction.LISTING_EIDS_AUTHORIZATION_STARTED, entityType: AuditEntityType.LISTING, entityId: listingId, changes: { listingId, authorizationId: pending.id, domain: listing.listingDomain } });

    try {
      const identity = await this.prisma.eidsIdentity.findUnique({ where: { userId: user.id }, select: { userCode: true } });
      if (!identity?.userCode) throw new ServiceUnavailableException('EİDS kullanıcı kimliği için kullanıcı kodu bulunamadı.');
      const input: EidsListingAuthorizationInput = { listingId, userId: user.id, domain: listing.listingDomain, userCode: identity.userCode, localSnapshot: buildLocalSnapshot(listing) };
      const result = listing.listingDomain === ListingDomain.PROPERTY ? await this.provider.verifyProperty(input) : await this.provider.verifyVehicle(input);
      const verified = await this.markVerified(user.id, listingId, result);
      return this.toResponse(verified);
    } catch (error) {
      await this.markFailed(user.id, listingId, safeFailureReason(error));
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('EİDS ilan yetkilendirmesi şu anda tamamlanamadı.');
    }
  }

  async getAuthorization(user: AuthenticatedUser, listingId: string) {
    const listing = await this.getOwnedListing(user.id, listingId);
    const authorization = await this.prisma.eidsListingAuthorization.findUnique({ where: { listingId } });
    if (!authorization) return { listingId, domain: listing.listingDomain, status: EidsListingAuthorizationStatus.NOT_VERIFIED };
    if (authorization.status === EidsListingAuthorizationStatus.VERIFIED && this.isExpired(authorization.validUntil)) {
      const expired = await this.markExpired(user.id, listingId);
      return this.toResponse(expired);
    }
    return this.toResponse(authorization);
  }

  async assertPublishAllowed(userId: string, listingId: string, domain: ListingDomain): Promise<void> {
    const authorization = await this.prisma.eidsListingAuthorization.findUnique({ where: { listingId } });
    if (authorization?.domain !== domain || authorization.status !== EidsListingAuthorizationStatus.VERIFIED) {
      await this.auditBlocked(userId, listingId, domain, authorization?.status ?? EidsListingAuthorizationStatus.NOT_VERIFIED);
      throw new ForbiddenException({ code: 'EIDS_LISTING_AUTHORIZATION_REQUIRED', message: 'İlanı yayınlamak için EİDS ilan yetkilendirmesi gereklidir.' });
    }
    if (this.isExpired(authorization.validUntil)) {
      await this.markExpired(userId, listingId);
      await this.auditBlocked(userId, listingId, domain, EidsListingAuthorizationStatus.EXPIRED);
      throw new ForbiddenException({ code: 'EIDS_LISTING_AUTHORIZATION_EXPIRED', message: 'EİDS ilan yetkilendirmesinin süresi dolmuştur.' });
    }
    if (!this.isAllowedVerificationMethod(authorization.verificationMethod)) {
      await this.auditBlocked(userId, listingId, domain, authorization.status);
      throw new ForbiddenException({ code: 'EIDS_LISTING_AUTHORIZATION_METHOD_NOT_ALLOWED', message: 'İlan yetkilendirme yöntemi yayın için uygun değildir.' });
    }
  }

  async markExpired(userId: string, listingId: string) {
    return this.transition(userId, listingId, EidsListingAuthorizationStatus.EXPIRED, { failedAt: null, revokedAt: null, lastCheckedAt: new Date() }, AuditAction.LISTING_EIDS_AUTHORIZATION_EXPIRED);
  }

  async markRevoked(userId: string, listingId: string, reason = 'external_revocation') {
    return this.transition(userId, listingId, EidsListingAuthorizationStatus.REVOKED, { revokedAt: new Date(), failureReason: reason, lastCheckedAt: new Date() }, AuditAction.LISTING_EIDS_AUTHORIZATION_REVOKED);
  }

  private async assertVerifiedIdentity(userId: string): Promise<void> {
    const identity = await this.eids.getIdentityStatus(userId);
    const adminTestAllowed = this.config.get<boolean | string>('EIDS_ALLOW_ADMIN_TEST') === true || this.config.get<string>('EIDS_ALLOW_ADMIN_TEST') === 'true';
    if (identity.status !== EidsIdentityStatus.VERIFIED || (identity.verificationMethod !== EidsVerificationMethod.EIDS && !(adminTestAllowed && identity.verificationMethod === EidsVerificationMethod.ADMIN_TEST))) {
      throw new ForbiddenException({ code: 'EIDS_IDENTITY_REQUIRED', message: 'İlan EİDS yetkilendirmesi için önce kullanıcı kimliği doğrulanmalıdır.' });
    }
  }

  private async transitionToPending(listing: ListingRecord, existing: AuthorizationRecord | null) {
    const now = new Date();
    const data = { domain: listing.listingDomain, userId: listing.ownerId, status: EidsListingAuthorizationStatus.PENDING, verificationMethod: null, externalReference: null, snapshot: Prisma.JsonNull, validUntil: null, nextCheckAt: null, verifiedAt: null, revokedAt: null, failedAt: null, lastCheckedAt: now, failureReason: null } as const;
    if (!existing) return this.prisma.eidsListingAuthorization.create({ data: { listingId: listing.id, ...data } });
    assertTransition(existing.status, EidsListingAuthorizationStatus.PENDING);
    return this.prisma.eidsListingAuthorization.update({ where: { id: existing.id }, data });
  }

  private async markVerified(userId: string, listingId: string, result: EidsListingAuthorizationResult) {
    const current = await this.prisma.eidsListingAuthorization.findUnique({ where: { listingId } });
    if (!current) throw new NotFoundException('EİDS ilan yetkilendirme kaydı bulunamadı.');
    assertTransition(current.status, EidsListingAuthorizationStatus.VERIFIED);
    const now = new Date();
    const updated = await this.prisma.eidsListingAuthorization.update({ where: { id: current.id }, data: { status: EidsListingAuthorizationStatus.VERIFIED, verificationMethod: result.verificationMethod, externalReference: result.externalReference ?? null, snapshot: result.snapshot ? result.snapshot as Prisma.InputJsonValue : Prisma.JsonNull, validUntil: result.validUntil ?? null, nextCheckAt: result.nextCheckAt ?? null, verifiedAt: now, revokedAt: null, failedAt: null, lastCheckedAt: now, failureReason: null } });
    await this.audit.log({ actorUserId: userId, action: AuditAction.LISTING_EIDS_AUTHORIZATION_VERIFIED, entityType: AuditEntityType.LISTING, entityId: listingId, changes: { listingId, authorizationId: updated.id, domain: updated.domain, verificationMethod: updated.verificationMethod } });
    return updated;
  }

  private async markFailed(userId: string, listingId: string, reason: string): Promise<void> {
    const current = await this.prisma.eidsListingAuthorization.findUnique({ where: { listingId } });
    if (!current) return;
    if (current.status !== EidsListingAuthorizationStatus.PENDING) return;
    const now = new Date();
    await this.prisma.eidsListingAuthorization.update({ where: { id: current.id }, data: { status: EidsListingAuthorizationStatus.FAILED, failedAt: now, lastCheckedAt: now, failureReason: reason, verificationMethod: null, verifiedAt: null } });
    await this.audit.log({ actorUserId: userId, action: AuditAction.LISTING_EIDS_AUTHORIZATION_FAILED, entityType: AuditEntityType.LISTING, entityId: listingId, changes: { listingId, authorizationId: current.id, domain: current.domain, reason } });
  }

  private async transition(userId: string, listingId: string, target: EidsListingAuthorizationStatus, data: Prisma.EidsListingAuthorizationUpdateInput, action: AuditAction) {
    const current = await this.prisma.eidsListingAuthorization.findUnique({ where: { listingId } });
    if (!current || current.userId !== userId) throw new NotFoundException('EİDS ilan yetkilendirme kaydı bulunamadı.');
    assertTransition(current.status, target);
    const updated = await this.prisma.eidsListingAuthorization.update({ where: { id: current.id }, data: { status: target, ...data } });
    await this.audit.log({ actorUserId: userId, action, entityType: AuditEntityType.LISTING, entityId: listingId, changes: { listingId, authorizationId: current.id, domain: current.domain } });
    return updated;
  }

  private async getOwnedListing(userId: string, listingId: string): Promise<ListingRecord> {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId: userId }, select: { id: true, ownerId: true, listingDomain: true, city: true, district: true, neighborhood: true, address: true, vehicleDetails: { select: { brand: true, model: true, year: true, mileage: true } } } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    return listing;
  }

  private isExpired(validUntil: Date | null): boolean { return Boolean(validUntil && validUntil <= new Date()); }
  private isAllowedVerificationMethod(method: EidsVerificationMethod | null): boolean { return method === EidsVerificationMethod.EIDS || (method === EidsVerificationMethod.ADMIN_TEST && (this.config.get<boolean | string>('EIDS_ALLOW_ADMIN_TEST') === true || this.config.get<string>('EIDS_ALLOW_ADMIN_TEST') === 'true')); }
  private async auditBlocked(userId: string, listingId: string, domain: ListingDomain, status: EidsListingAuthorizationStatus): Promise<void> { await this.audit.log({ actorUserId: userId, action: AuditAction.LISTING_PUBLISH_BLOCKED_BY_EIDS, entityType: AuditEntityType.LISTING, entityId: listingId, changes: { listingId, domain, status } }); }
  private toResponse(record: AuthorizationRecord) { return { id: record.id, listingId: record.listingId, userId: record.userId, domain: record.domain, status: record.status, verificationMethod: record.verificationMethod, externalReference: record.externalReference, validUntil: record.validUntil, nextCheckAt: record.nextCheckAt, verifiedAt: record.verifiedAt, revokedAt: record.revokedAt, failedAt: record.failedAt, lastCheckedAt: record.lastCheckedAt, failureReason: record.failureReason }; }
}

type ListingRecord = Prisma.ListingGetPayload<{ select: { id: true; ownerId: true; listingDomain: true; city: true; district: true; neighborhood: true; address: true; vehicleDetails: { select: { brand: true; model: true; year: true; mileage: true } } } }>;
type AuthorizationRecord = Prisma.EidsListingAuthorizationGetPayload<object>;

function assertTransition(from: EidsListingAuthorizationStatus, to: EidsListingAuthorizationStatus): void {
  if (!transitions[from].includes(to)) throw new ConflictException(`Geçersiz EİDS ilan yetkilendirme geçişi: ${from} → ${to}.`);
}

function buildLocalSnapshot(listing: ListingRecord): Record<string, unknown> {
  return { domain: listing.listingDomain, city: listing.city, district: listing.district, neighborhood: listing.neighborhood, address: listing.address, vehicle: listing.vehicleDetails ?? null };
}

function safeFailureReason(error: unknown): string {
  if (error instanceof ServiceUnavailableException) return 'provider_unavailable';
  if (error instanceof Error && error.message.length < 160) return error.message;
  return 'provider_failed';
}
