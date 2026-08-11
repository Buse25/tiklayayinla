import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, AuditEntityType, MembershipStatus, OrganizationApplicationStatus, OrganizationRole, OrganizationStatus, OrganizationType, Prisma, User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuditContextService } from '../audit/audit-context.service';
import { EmailVerificationService } from './email-verification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import type { VerificationRequiredResponseDto } from './dto/verification.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordResetDto, ForgotPasswordRequestDto } from './dto/forgot-password.dto';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { GoogleLoginDto } from './dto/google-login.dto';

@Injectable()
export class AuthService {
  private readonly accessSecret = requiredEnv('JWT_ACCESS_SECRET');
  private readonly refreshSecret = requiredEnv('JWT_REFRESH_SECRET');
  private readonly accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
  private readonly refreshTtl = process.env.JWT_REFRESH_TTL ?? '30d';
  private readonly refreshTtlMs = parseDuration(this.refreshTtl);
  private readonly saltRounds = 12;
  private readonly googleClientId = process.env.GOOGLE_CLIENT_ID;
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditContext: AuditContextService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<VerificationRequiredResponseDto> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, include: activeMembershipInclude });
    if (existing?.emailVerified) throw new ConflictException('Bu e-posta adresi zaten kullanÄ±mda.');
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    try {
      const user = existing
        ? await this.prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
              where: { id: existing.id },
              data: {
                passwordHash,
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                phone: dto.phone ?? undefined,
                status: UserStatus.ACTIVE,
                emailVerified: false,
                emailVerifiedAt: null,
              },
            });
            if (dto.organization && !existing.organizationMemberships?.length) {
              await createOrganizationMembership(tx, updated.id, dto.organization, this.auditContext.get());
            }
            return updated;
          })
        : await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
              data: {
                email,
                passwordHash,
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                phone: dto.phone ?? undefined,
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
                emailVerified: false,
              },
            });
            if (dto.organization) {
              await createOrganizationMembership(tx, created.id, dto.organization, this.auditContext.get());
            }
            return created;
          });

      return this.emailVerificationService.createAndSendCode(user.id, email);
    } catch (error) {
      if (isPrismaUniqueViolation(error)) throw new ConflictException('Bu e-posta adresi zaten kullanÄ±mda.');
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, include: activeMembershipInclude });
    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('E-posta veya parola geçersiz.');
    this.assertActive(user);
    return this.createSession(user);
  }

  async loginWithGoogle(dto: GoogleLoginDto): Promise<AuthResponseDto> {
    if (!this.googleClientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not defined.');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.token,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new UnauthorizedException('Google kimlik doğrulaması başarısız oldu.');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Google kimlik doğrulaması başarısız oldu.');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('Google hesabındaki e-posta doğrulanmamış.');
    }

    const email = payload.email.toLowerCase();
    const sub = payload.sub;

    let user = await this.prisma.user.findUnique({
      where: { googleId: sub },
      include: activeMembershipInclude,
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email },
        include: activeMembershipInclude,
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: sub,
            emailVerified: true,
          },
          include: activeMembershipInclude,
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            firstName: (payload.given_name || payload.name || 'Google').trim(),
            lastName: (payload.family_name || '').trim(),
            googleId: sub,
            emailVerified: true,
            status: UserStatus.ACTIVE,
            role: UserRole.USER,
          },
          include: activeMembershipInclude,
        });
      }
    }

    this.assertActive(user);
    return this.createSession(user);
  }

  async requestForgotPassword(dto: ForgotPasswordRequestDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, status: true } });
    if (user && user.status === UserStatus.ACTIVE) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      await this.prisma.$transaction(async tx => {
        await tx.passwordChangeCode.updateMany({ where: { userId: user.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
        await tx.passwordChangeCode.create({ data: { userId: user.id, codeHash: hashResetCode(code), expiresAt, resendAvailableAt: new Date(Date.now() + 60_000) } });
      });
      try { await this.mail.sendPasswordChangeCode({ to: user.email, code, expiresAt }); }
      catch (error) { await this.prisma.passwordChangeCode.updateMany({ where: { userId: user.id, codeHash: hashResetCode(code), consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } }); throw error; }
    }
    return { message: 'E-posta adresiniz kayıtlıysa şifre yenileme kodu gönderildi.' };
  }

  async resetForgotPassword(dto: ForgotPasswordResetDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) throw new ConflictException('Yeni şifreler eşleşmiyor.');
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() }, select: { id: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Kod geçersiz veya süresi dolmuş.');
    const code = await this.prisma.passwordChangeCode.findFirst({ where: { userId: user.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!code || !safeResetCompare(code.codeHash, hashResetCode(dto.code))) {
      if (code) await this.prisma.passwordChangeCode.update({ where: { id: code.id }, data: { attemptCount: { increment: 1 }, invalidatedAt: code.attemptCount + 1 >= code.maxAttempts ? new Date() : null } });
      throw new UnauthorizedException('Kod geçersiz veya süresi dolmuş.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
      await tx.passwordChangeCode.update({ where: { id: code.id }, data: { consumedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async refresh(rawToken: string): Promise<AuthResponseDto> {
    const payload = await this.verifyRefreshToken(rawToken);
    const storedToken = await this.prisma.refreshToken.findFirst({ where: { id: payload.jti, userId: payload.sub, revokedAt: null }, include: { user: { include: activeMembershipInclude } } });
    if (!storedToken || storedToken.expiresAt <= new Date() || !(await bcrypt.compare(rawToken, storedToken.tokenHash))) throw new UnauthorizedException('Refresh token geçersiz veya iptal edilmiş.');
    this.assertActive(storedToken.user);
    const revoked = await this.prisma.refreshToken.updateMany({ where: { id: storedToken.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (revoked.count !== 1) throw new UnauthorizedException('Refresh token zaten kullanılmış.');
    return this.createSession(storedToken.user);
  }

  async logout(rawToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(rawToken);
    const storedToken = await this.prisma.refreshToken.findFirst({ where: { id: payload.jti, userId: payload.sub, revokedAt: null } });
    if (!storedToken || !(await bcrypt.compare(rawToken, storedToken.tokenHash))) throw new UnauthorizedException('Refresh token geçersiz veya iptal edilmiş.');
    await this.prisma.refreshToken.update({ where: { id: storedToken.id }, data: { revokedAt: new Date() } });
  }

  async validateAccessUser(userId: string, sessionVersion?: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: activeMembershipInclude });
    if (!user || user.sessionVersion !== sessionVersion) throw new UnauthorizedException();
    this.assertActive(user);
    const latestApp = await this.prisma.organizationApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return toUserResponse(user, null, latestApp?.status ?? null);
  }

  async createSessionForUserId(userId: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: activeMembershipInclude });
    if (!user) throw new UnauthorizedException();
    this.assertActive(user);
    return this.createSession(user);
  }

  private async createSession(user: User, client: PrismaService | Prisma.TransactionClient = this.prisma, membership?: ActiveMembership | null): Promise<AuthResponseDto> {
    const tokenId = randomUUID();
    const latestApp = await client.organizationApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    const userResponse = toUserResponse(user, membership ?? getActiveMembership(user), latestApp?.status ?? null);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, type: 'access', sessionVersion: user.sessionVersion }, { secret: this.accessSecret, expiresIn: this.accessTtl });
    const refreshToken = await this.jwt.signAsync({ sub: user.id, jti: tokenId, type: 'refresh', sessionVersion: user.sessionVersion }, { secret: this.refreshSecret, expiresIn: this.refreshTtl });
    await client.refreshToken.create({ data: { id: tokenId, userId: user.id, tokenHash: await bcrypt.hash(refreshToken, this.saltRounds), expiresAt: new Date(Date.now() + this.refreshTtlMs) } });
    return { accessToken, refreshToken, user: userResponse };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.refreshSecret });
      if (payload.type !== 'refresh' || !payload.sub || !payload.jti) throw new Error('Invalid token type');
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token geçersiz veya süresi dolmuş.');
    }
  }

  private assertActive(user: User): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Bu hesap askıya alınmış.');
    }
    if (user.status === UserStatus.DELETED) {
      throw new ForbiddenException('Bu hesap silinmiş.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Kullanıcı hesabı aktif değil.');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'E-posta adresiniz doğrulanmamış.' });
    }
  }
}

const activeMembershipInclude = {
  organizationMemberships: {
    where: { status: MembershipStatus.ACTIVE },
    orderBy: { createdAt: 'asc' },
    take: 1,
    include: { organization: true },
  },
} as const;

type ActiveMembership = Prisma.OrganizationMembershipGetPayload<{ include: { organization: true } }>;
type UserWithMembership = User & { organizationMemberships?: ActiveMembership[] };

function getActiveMembership(user: User | UserWithMembership): ActiveMembership | null {
  return 'organizationMemberships' in user ? user.organizationMemberships?.[0] ?? null : null;
}

function toUserResponse(
  user: User | UserWithMembership,
  membership?: ActiveMembership | null,
  applicationStatus?: OrganizationApplicationStatus | null,
): UserResponseDto {
  const activeMembership = membership ?? getActiveMembership(user);
  const organization = activeMembership ? { id: activeMembership.organization.id, name: activeMembership.organization.name, type: activeMembership.organization.type, membershipRole: activeMembership.role, membershipStatus: activeMembership.status } : null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    organization,
    organizationId: organization?.id ?? null,
    organizationName: organization?.name ?? null,
    organizationType: organization?.type ?? null,
    membershipRole: organization?.membershipRole ?? null,
    membershipStatus: organization?.membershipStatus ?? null,
    organizationApplicationStatus: applicationStatus ?? null,
  };
}

async function createOrganizationMembership(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationDto: NonNullable<RegisterDto['organization']>,
  context: ReturnType<AuditContextService['get']>,
): Promise<void> {
  const organization = await tx.organization.create({ data: organizationDto });
  const membership = await tx.organizationMembership.create({ data: { organizationId: organization.id, userId, role: OrganizationRole.OWNER, status: MembershipStatus.ACTIVE }, include: { organization: true } });
  await tx.auditLog.createMany({
    data: [
      {
        actorUserId: userId,
        action: AuditAction.ORGANIZATION_CREATED,
        entityType: AuditEntityType.ORGANIZATION,
        entityId: organization.id,
        changes: { name: organization.name, type: organization.type },
        ipAddress: context?.ipAddress?.slice(0, 64),
        userAgent: context?.userAgent?.slice(0, 512),
      },
      {
        actorUserId: userId,
        action: AuditAction.ORGANIZATION_MEMBERSHIP_CREATED,
        entityType: AuditEntityType.ORGANIZATION,
        entityId: organization.id,
        changes: { membershipRole: membership.role, membershipStatus: membership.status },
        ipAddress: context?.ipAddress?.slice(0, 64),
        userAgent: context?.userAgent?.slice(0, 512),
      },
    ],
  });
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable must be set.`);
  return value;
}

function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error('JWT_REFRESH_TTL must use s, m, h, or d units.');
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
  return Number(match[1]) * factor;
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

function hashResetCode(code: string): string { return createHmac('sha256', requiredEnv('JWT_ACCESS_SECRET')).update(code).digest('hex'); }
function safeResetCompare(left: string, right: string): boolean { const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex'); return a.length === b.length && timingSafeEqual(a, b); }
