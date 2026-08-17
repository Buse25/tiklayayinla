import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, AuditEntityType, EidsIdentityStatus, EidsVerificationMethod, MembershipStatus, PhoneVerificationMethod } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EidsClientError, EidsHttpClient } from './eids.client';

export const EIDS_CORRELATION_COOKIE = 'tiklayayinla_eids_correlation';
const SESSION_TTL_MS = 10 * 60_000;

export type EidsProfileStatus = {
  configured: boolean;
  status: EidsIdentityStatus;
  verified: boolean;
  verifiedAt: Date | null;
  verificationMethod: EidsVerificationMethod | null;
};

export type EidsAuthorizeResult = { authorizeUrl: string; correlationToken: string; maxAge: number };
export type EidsCallbackResult = 'success' | 'failed' | 'incomplete';

const requiredConfigKeys = [
  'EIDS_FIRMA_CODE', 'EIDS_BASIC_AUTH_USERNAME', 'EIDS_BASIC_AUTH_PASSWORD',
  'EIDS_RETURN_URL', 'EIDS_SSO_BASE_URL', 'EIDS_API_BASE_URL',
  'EIDS_GET_USER_CODE_PATH', 'EIDS_GET_USER_CODE_REQUEST_FIELD', 'EIDS_GET_USER_CODE_RESPONSE_FIELD',
] as const;

@Injectable()
export class EidsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly audit: AuditService, private readonly client: EidsHttpClient) {}

  isEnabled(): boolean {
    const value = this.config.get<boolean | string>('EIDS_ENABLED');
    return value === true || value === 'true';
  }

  isConfigured(): boolean {
    if (!this.isEnabled()) return false;
    return requiredConfigKeys.every((key) => {
      const value = this.config.get<string>(key);
      return typeof value === 'string' && value.trim().length > 0;
    });
  }

  async getIdentityStatus(userId: string): Promise<EidsProfileStatus> {
    const identity = await this.prisma.eidsIdentity.findUnique({ where: { userId }, select: { status: true, verifiedAt: true, verificationMethod: true, lastCheckedAt: true } });
    const stalePending = identity?.status === EidsIdentityStatus.PENDING && (!identity.lastCheckedAt || Date.now() - identity.lastCheckedAt.getTime() > SESSION_TTL_MS);
    const status = identity && !stalePending ? identity.status : EidsIdentityStatus.NOT_VERIFIED;
    return { configured: this.isConfigured(), status, verified: status === EidsIdentityStatus.VERIFIED, verifiedAt: status === EidsIdentityStatus.VERIFIED ? identity?.verifiedAt ?? null : null, verificationMethod: status === EidsIdentityStatus.VERIFIED ? identity?.verificationMethod ?? null : null };
  }

  async createAuthorizeSession(userId: string): Promise<EidsAuthorizeResult> {
    if (!this.isConfigured()) {
      await this.auditFailure(userId, 'configuration');
      throw new ServiceUnavailableException('EİDS entegrasyonu henüz kullanıma hazır değil.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true, phoneVerificationMethod: true } });
    if (!user?.phone) {
      await this.auditFailure(userId, 'phone_missing');
      throw new ConflictException('EİDS doğrulaması için telefon numaranızı eklemeniz gerekir.');
    }
    if (!user.phoneVerifiedAt || user.phoneVerificationMethod !== PhoneVerificationMethod.OTP) {
      await this.auditFailure(userId, 'otp_required');
      throw new ConflictException('EİDS doğrulaması için telefon numaranızın SMS OTP ile doğrulanması gerekir.');
    }

    const correlationToken = randomBytes(32).toString('base64url');
    const correlationTokenHash = hashCorrelationToken(correlationToken);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.eidsVerificationSession.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.eidsIdentity.upsert({ where: { userId }, create: { userId, status: EidsIdentityStatus.PENDING, verificationMethod: null, verifiedAt: null, lastCheckedAt: now }, update: { status: EidsIdentityStatus.PENDING, verificationMethod: null, verifiedAt: null, lastCheckedAt: now } });
      await tx.eidsVerificationSession.create({ data: { userId, correlationTokenHash, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) } });
    });
    await this.audit.log({ actorUserId: userId, action: AuditAction.EIDS_AUTHORIZATION_STARTED, entityType: AuditEntityType.USER, entityId: userId });

    const authorizeUrl = new URL('/oturum', this.config.getOrThrow<string>('EIDS_SSO_BASE_URL'));
    authorizeUrl.searchParams.set('firmaKodu', this.config.getOrThrow<string>('EIDS_FIRMA_CODE'));
    return { authorizeUrl: authorizeUrl.toString(), correlationToken, maxAge: SESSION_TTL_MS / 1000 };
  }

  async handleCallback(correlationToken: string | undefined, yetkiKodu: string | undefined, durum: string | undefined): Promise<EidsCallbackResult> {
    if (!correlationToken) return 'failed';
    const now = new Date();
    const session = await this.prisma.eidsVerificationSession.findFirst({ where: { correlationTokenHash: hashCorrelationToken(correlationToken), consumedAt: null, processingAt: null, expiresAt: { gt: now } }, select: { id: true, userId: true } });
    if (!session) return 'failed';
    const claimed = await this.prisma.eidsVerificationSession.updateMany({ where: { id: session.id, consumedAt: null, processingAt: null, expiresAt: { gt: now } }, data: { processingAt: now } });
    if (claimed.count !== 1) return 'failed';
    await this.audit.log({ actorUserId: session.userId, action: AuditAction.EIDS_CALLBACK_RECEIVED, entityType: AuditEntityType.USER, entityId: session.userId, changes: { sessionId: session.id } });
    if (!yetkiKodu || !isPositiveStatus(durum)) {
      await this.finishFailed(session.id, session.userId, now);
      return 'failed';
    }

    try {
      const { userCode } = await this.client.getUserCode({ authorizationCode: yetkiKodu });
      await this.prisma.$transaction(async (tx) => {
        await tx.eidsIdentity.upsert({ where: { userId: session.userId }, create: { userId: session.userId, status: EidsIdentityStatus.VERIFIED, verificationMethod: EidsVerificationMethod.EIDS, userCode, verifiedAt: now, lastCheckedAt: now }, update: { status: EidsIdentityStatus.VERIFIED, verificationMethod: EidsVerificationMethod.EIDS, userCode, verifiedAt: now, lastCheckedAt: now } });
        await tx.eidsVerificationSession.update({ where: { id: session.id }, data: { consumedAt: now, processingAt: null } });
      });
      await this.audit.log({ actorUserId: session.userId, action: AuditAction.EIDS_VERIFICATION_SUCCEEDED, entityType: AuditEntityType.USER, entityId: session.userId, changes: { sessionId: session.id } });
      return 'success';
    } catch (error) {
      if (error instanceof EidsClientError) {
        await this.audit.log({ actorUserId: session.userId, action: AuditAction.EIDS_GET_USER_CODE_FAILED, entityType: AuditEntityType.USER, entityId: session.userId, changes: { reason: error.reason, sessionId: session.id } });
      }
      await this.finishFailed(session.id, session.userId, new Date());
      return 'failed';
    }
  }

  private async finishFailed(sessionId: string, userId: string, checkedAt: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.eidsIdentity.upsert({ where: { userId }, create: { userId, status: EidsIdentityStatus.FAILED, verificationMethod: null, lastCheckedAt: checkedAt }, update: { status: EidsIdentityStatus.FAILED, verificationMethod: null, verifiedAt: null, lastCheckedAt: checkedAt } });
      await tx.eidsVerificationSession.update({ where: { id: sessionId }, data: { consumedAt: checkedAt, processingAt: null } });
    });
    await this.audit.log({ actorUserId: userId, action: AuditAction.EIDS_CALLBACK_FAILED, entityType: AuditEntityType.USER, entityId: userId });
  }

  private async auditFailure(userId: string, reason: 'configuration' | 'phone_missing' | 'otp_required'): Promise<void> {
    await this.audit.log({ actorUserId: userId, action: AuditAction.EIDS_AUTHORIZATION_FAILED, entityType: AuditEntityType.USER, entityId: userId, changes: { reason } });
  }
}

export function hashCorrelationToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function isPositiveStatus(value: string | undefined): boolean { if (!value?.trim()) return false; return !new Set(['0', '-1', 'false', 'fail', 'failed', 'hata', 'red', 'no']).has(value.trim().toLowerCase()); }
