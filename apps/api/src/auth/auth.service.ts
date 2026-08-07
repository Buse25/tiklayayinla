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

@Injectable()
export class AuthService {
  private readonly accessSecret = requiredEnv('JWT_ACCESS_SECRET');
  private readonly refreshSecret = requiredEnv('JWT_REFRESH_SECRET');
  private readonly accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
  private readonly refreshTtl = process.env.JWT_REFRESH_TTL ?? '30d';
  private readonly refreshTtlMs = parseDuration(this.refreshTtl);
  private readonly saltRounds = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditContext: AuditContextService,
    private readonly emailVerificationService: EmailVerificationService,
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
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('E-posta veya parola geÃ§ersiz.');
    this.assertActive(user);
    return this.createSession(user);
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

  async validateAccessUser(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: activeMembershipInclude });
    if (!user) throw new UnauthorizedException();
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
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, type: 'access' }, { secret: this.accessSecret, expiresIn: this.accessTtl });
    const refreshToken = await this.jwt.signAsync({ sub: user.id, jti: tokenId, type: 'refresh' }, { secret: this.refreshSecret, expiresIn: this.refreshTtl });
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
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Kullanıcı hesabı aktif değil.');
    if (!user.emailVerified) throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'E-posta adresiniz doğrulanmamış.' });
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
