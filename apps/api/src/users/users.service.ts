import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { AuditAction, AuditEntityType, MembershipStatus, OrganizationApplicationStatus, Prisma, UserRole, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordCodeResponseDto } from './dto/password-code-response.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

const profileSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true, about: true, address: true,
  role: true, status: true, createdAt: true, updatedAt: true,
  organizationMemberships: {
    where: { status: MembershipStatus.ACTIVE },
    orderBy: { createdAt: 'asc' },
    take: 1,
    include: { organization: { select: { id: true, name: true, type: true, city: true, district: true, address: true } } },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly mail: MailService) {}

  async getMyProfile(userId: string): Promise<MyProfileResponseDto> {
    const profile = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: profileSelect });
    const latestApp = await this.prisma.organizationApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return toProfileResponse(profile, latestApp?.status ?? null);
  }

  async updateUserStatus(actorRole: UserRole, userId: string, dto: UpdateUserStatusDto): Promise<void> {
    if (actorRole !== UserRole.ADMIN) throw new ForbiddenException('Bu işlem için admin yetkisi gerekir.');
    if (dto.status === UserStatus.DELETED) throw new ConflictException('DELETED durumu bu ekrandan verilemez.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.status === UserStatus.DELETED) throw new ConflictException('DELETED kullanıcı tekrar aktif edilemez.');
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: userId }, data: { status: dto.status, sessionVersion: { increment: 1 } } });
      if (dto.status !== UserStatus.ACTIVE) await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto): Promise<MyProfileResponseDto> {
    const profile = await this.prisma.user.update({ where: { id: userId }, data: dto, select: profileSelect });
    if (Object.keys(dto).length) await this.audit.log({ actorUserId: userId, action: AuditAction.USER_PROFILE_UPDATED, entityType: AuditEntityType.USER, entityId: userId, changes: { changedFields: Object.keys(dto) } });
    const latestApp = await this.prisma.organizationApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return toProfileResponse(profile, latestApp?.status ?? null);
  }

  async requestPasswordCode(userId: string): Promise<PasswordCodeResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const now = new Date();
    const latest = await this.prisma.passwordChangeCode.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (latest && latest.resendAvailableAt > now && !latest.consumedAt && !latest.invalidatedAt) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'PASSWORD_CHANGE_CODE_RATE_LIMITED',
          message: 'Lütfen yeni kod istemeden önce bekleyin.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const resendAvailableAt = new Date(Date.now() + 60_000);
    const codeHash = hashCode(code);
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordChangeCode.updateMany({ where: { userId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
      await tx.passwordChangeCode.create({ data: { userId, codeHash, expiresAt, resendAvailableAt } });
    });
    try {
      await this.mail.sendPasswordChangeCode({ to: user.email, code, expiresAt });
    } catch (error) {
      await this.prisma.passwordChangeCode.updateMany({ where: { userId, codeHash, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
      throw error;
    }
    return { email: maskEmail(user.email), expiresAt, resendAvailableAt };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) throw new ConflictException('Yeni şifreler eşleşmiyor.');
    const codes = await this.prisma.passwordChangeCode.findMany({ where: { userId, consumedAt: null, invalidatedAt: null }, orderBy: { createdAt: 'desc' } });
    const active = codes.find((item) => item.expiresAt > new Date() && item.attemptCount < item.maxAttempts);
    if (!active) throw new UnauthorizedException('Kod geçersiz veya süresi dolmuş.');
    const provided = hashCode(dto.code);
    const matches = safeCompare(active.codeHash, provided);
    if (!matches) {
      const attemptCount = active.attemptCount + 1;
      await this.prisma.passwordChangeCode.update({ where: { id: active.id }, data: { attemptCount, invalidatedAt: attemptCount >= active.maxAttempts ? new Date() : null } });
      throw new UnauthorizedException('Kod geçersiz veya süresi dolmuş.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
      await tx.passwordChangeCode.update({ where: { id: active.id }, data: { consumedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async deleteAccount(userId: string, role?: UserRole): Promise<void> {
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: userId }, data: { status: UserStatus.DELETED, deletedAt: new Date(), sessionVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }
}

function hashCode(code: string): string { return createHmac('sha256', requiredEnv('JWT_ACCESS_SECRET')).update(code).digest('hex'); }
function safeCompare(left: string, right: string): boolean { const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex'); return a.length === b.length && timingSafeEqual(a, b); }
function maskEmail(email: string): string { const [local, domain = ''] = email.split('@'); return `${local.slice(0, 1)}***${local.slice(-1)}@${domain}`; }
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`${name} environment variable must be set.`); return value; }

type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

function toProfileResponse(profile: ProfileRecord, applicationStatus?: OrganizationApplicationStatus | null): MyProfileResponseDto {
  const membership = profile.organizationMemberships[0];
  const { organizationMemberships, ...user } = profile;
  return {
    ...user,
    organization: membership ? {
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      organizationType: membership.organization.type,
      membershipRole: membership.role,
      membershipStatus: membership.status,
      city: (membership.organization as any).city ?? null,
      district: (membership.organization as any).district ?? null,
      address: (membership.organization as any).address ?? null,
    } : { organizationId: null, organizationName: null, organizationType: null, membershipRole: null, membershipStatus: null, city: null, district: null, address: null },
    organizationApplicationStatus: applicationStatus ?? null,
  };
}
