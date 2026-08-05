import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AuditAction, AuditEntityType, ConnectionStatus, Prisma } from '@prisma/client';
import { AdapterRegistry } from '../publishing/adapter.registry';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialEncryptionService } from './credential-encryption.service';
import { CreateUserPortalAccountDto } from './dto/create-user-portal-account.dto';
import { UpdateUserPortalAccountDto } from './dto/update-user-portal-account.dto';
import { PortalConnectionTestResponseDto, UserPortalAccountResponseDto } from './dto/user-portal-account-response.dto';
import { AuditService } from '../audit/audit.service';

const accountInclude = { portal: { select: { id: true, code: true, name: true, adapterKey: true, credentialSchema: true } } } satisfies Prisma.UserPortalAccountInclude;
type AccountWithPortal = Prisma.UserPortalAccountGetPayload<{ include: typeof accountInclude }>;

@Injectable()
export class UserPortalAccountsService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService, private readonly adapters: AdapterRegistry, private readonly audit: AuditService) {}

  async create(userId: string, dto: CreateUserPortalAccountDto): Promise<UserPortalAccountResponseDto> {
    const portal = await this.prisma.portal.findFirst({ where: { code: dto.portalCode, isActive: true } });
    if (!portal) throw new NotFoundException('Portal bulunamadı.');
    validateCredentials(dto.credentials, portal.credentialSchema);
    try {
      const account = await this.prisma.userPortalAccount.create({ data: { userId, portalId: portal.id, credentialsEncrypted: this.encryption.encrypt(dto.credentials), connectionStatus: ConnectionStatus.NOT_TESTED }, include: accountInclude });
      const response = toResponse(account);
      await this.audit.log({ actorUserId: userId, action: AuditAction.PORTAL_ACCOUNT_CREATED, entityType: AuditEntityType.PORTAL_ACCOUNT, entityId: response.id, changes: { portalCode: response.portal.code } });
      return response;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Bu portal için zaten bir hesabınız var.');
      throw error;
    }
  }

  async findAll(userId: string): Promise<UserPortalAccountResponseDto[]> { return (await this.prisma.userPortalAccount.findMany({ where: { userId }, include: accountInclude, orderBy: { portal: { name: 'asc' } } })).map(toResponse); }

  async findOne(userId: string, id: string): Promise<UserPortalAccountResponseDto> { return toResponse(await this.getOwned(userId, id)); }

  async update(userId: string, id: string, dto: UpdateUserPortalAccountDto): Promise<UserPortalAccountResponseDto> {
    const existing = await this.getOwned(userId, id);
    if (dto.credentials) validateCredentials(dto.credentials, existing.portal.credentialSchema);
    const account = await this.prisma.userPortalAccount.update({ where: { id }, data: { ...(dto.credentials && { credentialsEncrypted: this.encryption.encrypt(dto.credentials), connectionStatus: ConnectionStatus.NOT_TESTED, lastCheckedAt: null, lastError: null }) }, include: accountInclude });
    const response = toResponse(account);
    if (dto.credentials) await this.audit.log({ actorUserId: userId, action: AuditAction.PORTAL_ACCOUNT_UPDATED, entityType: AuditEntityType.PORTAL_ACCOUNT, entityId: id, changes: { credentialsUpdated: true, connectionStatus: response.connectionStatus } });
    return response;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.prisma.userPortalAccount.delete({ where: { id } });
    await this.audit.log({ actorUserId: userId, action: AuditAction.PORTAL_ACCOUNT_DELETED, entityType: AuditEntityType.PORTAL_ACCOUNT, entityId: id });
  }

  async testConnection(userId: string, id: string): Promise<PortalConnectionTestResponseDto> {
    const account = await this.getOwned(userId, id);
    const checkedAt = new Date();
    try {
      if (!['mock-rest', 'mock-xml'].includes(account.portal.code)) throw new UnprocessableEntityException('Bu sprintte yalnızca mock-rest ve mock-xml bağlantı testi desteklenir.');
      const credentials = this.encryption.decrypt(account.credentialsEncrypted);
      validateCredentials(credentials, account.portal.credentialSchema);
      this.adapters.get(account.portal.code);
      validateMockCredentials(account.portal.code, credentials);
      await this.prisma.userPortalAccount.update({ where: { id }, data: { connectionStatus: ConnectionStatus.CONNECTED, lastCheckedAt: checkedAt, lastError: null } });
      const response = { connected: true, connectionStatus: ConnectionStatus.CONNECTED, checkedAt };
      await this.audit.log({ actorUserId: userId, action: AuditAction.PORTAL_ACCOUNT_CONNECTION_TESTED, entityType: AuditEntityType.PORTAL_ACCOUNT, entityId: id, changes: { connected: true, connectionStatus: response.connectionStatus } });
      return response;
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      const lastError = error instanceof Error ? error.message : 'Portal bağlantısı doğrulanamadı.';
      await this.prisma.userPortalAccount.update({ where: { id }, data: { connectionStatus: ConnectionStatus.FAILED, lastCheckedAt: checkedAt, lastError } });
      const response = { connected: false, connectionStatus: ConnectionStatus.FAILED, checkedAt, lastError };
      await this.audit.log({ actorUserId: userId, action: AuditAction.PORTAL_ACCOUNT_CONNECTION_TESTED, entityType: AuditEntityType.PORTAL_ACCOUNT, entityId: id, changes: { connected: false, connectionStatus: response.connectionStatus } });
      return response;
    }
  }

  private async getOwned(userId: string, id: string): Promise<AccountWithPortal> { const account = await this.prisma.userPortalAccount.findFirst({ where: { id, userId }, include: accountInclude }); if (!account) throw new NotFoundException('Portal hesabı bulunamadı.'); return account; }
}

function toResponse(account: AccountWithPortal): UserPortalAccountResponseDto {
  const { credentialSchema: _credentialSchema, ...portal } = account.portal;
  return { id: account.id, connectionStatus: account.connectionStatus, lastCheckedAt: account.lastCheckedAt, lastError: account.lastError, portal };
}

function validateCredentials(credentials: Record<string, unknown>, rawSchema: Prisma.JsonValue | null): void {
  const schema = rawSchema as { fields?: Array<{ key?: unknown; required?: unknown }> } | null;
  const fields = schema?.fields;
  if (!Array.isArray(fields) || !fields.every((field) => typeof field.key === 'string')) throw new UnprocessableEntityException('Portal credential şeması geçersiz.');
  const allowedKeys = new Set(fields.map((field) => field.key as string));
  const unknownKeys = Object.keys(credentials).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length) throw new UnprocessableEntityException(`Tanımsız credential alanı: ${unknownKeys.join(', ')}.`);
  const missingKeys = fields.filter((field) => {
    const value = credentials[field.key as string];
    return field.required === true && (typeof value !== 'string' || !value.trim());
  }).map((field) => field.key as string);
  if (missingKeys.length) throw new UnprocessableEntityException(`Zorunlu credential alanları eksik: ${missingKeys.join(', ')}.`);
}

function validateMockCredentials(portalCode: string, credentials: Record<string, unknown>): void {
  if (portalCode === 'mock-rest' && credentials.apiKey === 'valid-rest-key') return;
  if (portalCode === 'mock-xml' && credentials.username === 'demo' && credentials.password === 'demo123') return;
  throw new Error('Mock portal credential bilgileri geçersiz.');
}

function isUniqueViolation(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
