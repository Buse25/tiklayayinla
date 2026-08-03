import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly accessSecret = requiredEnv('JWT_ACCESS_SECRET');
  private readonly refreshSecret = requiredEnv('JWT_REFRESH_SECRET');
  private readonly accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
  private readonly refreshTtl = process.env.JWT_REFRESH_TTL ?? '30d';
  private readonly refreshTtlMs = parseDuration(this.refreshTtl);
  private readonly saltRounds = 12;

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictException('Bu e-posta adresi zaten kullanımda.');
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    try {
      const user = await this.prisma.user.create({ data: { email, passwordHash, firstName: dto.firstName.trim(), lastName: dto.lastName.trim() } });
      return this.createSession(user);
    } catch (error) {
      if (isPrismaUniqueViolation(error)) throw new ConflictException('Bu e-posta adresi zaten kullanımda.');
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('E-posta veya parola geçersiz.');
    this.assertActive(user);
    return this.createSession(user);
  }

  async refresh(rawToken: string): Promise<AuthResponseDto> {
    const payload = await this.verifyRefreshToken(rawToken);
    const storedToken = await this.prisma.refreshToken.findFirst({ where: { id: payload.jti, userId: payload.sub, revokedAt: null }, include: { user: true } });
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    this.assertActive(user);
    return toUserResponse(user);
  }

  private async createSession(user: User): Promise<AuthResponseDto> {
    const tokenId = randomUUID();
    const userResponse = toUserResponse(user);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, type: 'access' }, { secret: this.accessSecret, expiresIn: this.accessTtl });
    const refreshToken = await this.jwt.signAsync({ sub: user.id, jti: tokenId, type: 'refresh' }, { secret: this.refreshSecret, expiresIn: this.refreshTtl });
    await this.prisma.refreshToken.create({ data: { id: tokenId, userId: user.id, tokenHash: await bcrypt.hash(refreshToken, this.saltRounds), expiresAt: new Date(Date.now() + this.refreshTtlMs) } });
    return { accessToken, refreshToken, user: userResponse };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.refreshSecret });
      if (payload.type !== 'refresh' || !payload.sub || !payload.jti) throw new Error('Invalid token type');
      return payload;
    } catch { throw new UnauthorizedException('Refresh token geçersiz veya süresi dolmuş.'); }
  }

  private assertActive(user: User): void { if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Kullanıcı hesabı aktif değil.'); }
}

function toUserResponse(user: User): UserResponseDto { return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, status: user.status, createdAt: user.createdAt }; }
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`${name} environment variable must be set.`); return value; }
function parseDuration(value: string): number { const match = /^(\d+)([smhd])$/.exec(value); if (!match) throw new Error('JWT_REFRESH_TTL must use s, m, h, or d units.'); const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!; return Number(match[1]) * factor; }
function isPrismaUniqueViolation(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
