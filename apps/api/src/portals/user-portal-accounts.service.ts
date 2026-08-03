import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConnectionStatus, Prisma } from '@prisma/client';
import { AdapterRegistry } from '../publishing/adapter.registry';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialEncryptionService } from './credential-encryption.service';
import { CreateUserPortalAccountDto } from './dto/create-user-portal-account.dto';
import { UpdateUserPortalAccountDto } from './dto/update-user-portal-account.dto';
import { PortalConnectionTestResponseDto, UserPortalAccountResponseDto } from './dto/user-portal-account-response.dto';

const accountInclude = { portal: { select: { id: true, code: true, name: true, adapterKey: true } } } satisfies Prisma.UserPortalAccountInclude;
type AccountWithPortal = Prisma.UserPortalAccountGetPayload<{ include: typeof accountInclude }>;

@Injectable()
export class UserPortalAccountsService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService, private readonly adapters: AdapterRegistry) {}

  async create(userId: string, dto: CreateUserPortalAccountDto): Promise<UserPortalAccountResponseDto> {
    const portal = await this.prisma.portal.findFirst({ where: { code: dto.portalCode, isActive: true } });
    if (!portal) throw new NotFoundException('Portal bulunamadı.');
    try {
      const account = await this.prisma.userPortalAccount.create({ data: { userId, portalId: portal.id, credentialsEncrypted: this.encryption.encrypt(dto.credentials), connectionStatus: ConnectionStatus.PENDING }, include: accountInclude });
      return toResponse(account);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Bu portal için zaten bir hesabınız var.');
      throw error;
    }
  }

  async findAll(userId: string): Promise<UserPortalAccountResponseDto[]> { return (await this.prisma.userPortalAccount.findMany({ where: { userId }, include: accountInclude, orderBy: { portal: { name: 'asc' } } })).map(toResponse); }

  async update(userId: string, id: string, dto: UpdateUserPortalAccountDto): Promise<UserPortalAccountResponseDto> {
    await this.getOwned(userId, id);
    const account = await this.prisma.userPortalAccount.update({ where: { id }, data: { ...(dto.credentials && { credentialsEncrypted: this.encryption.encrypt(dto.credentials), connectionStatus: ConnectionStatus.PENDING, lastCheckedAt: null }) }, include: accountInclude });
    return toResponse(account);
  }

  async remove(userId: string, id: string): Promise<void> { await this.getOwned(userId, id); await this.prisma.userPortalAccount.delete({ where: { id } }); }

  async testConnection(userId: string, id: string): Promise<PortalConnectionTestResponseDto> {
    const account = await this.getOwned(userId, id);
    const checkedAt = new Date();
    try {
      if (!['mock-rest', 'mock-xml'].includes(account.portal.code)) throw new UnprocessableEntityException('Bu sprintte yalnızca mock-rest ve mock-xml bağlantı testi desteklenir.');
      const credentials = this.encryption.decrypt(account.credentialsEncrypted);
      if (!Object.keys(credentials).length) throw new UnprocessableEntityException('Portal credential bilgisi boş olamaz.');
      this.adapters.get(account.portal.code);
      await this.prisma.userPortalAccount.update({ where: { id }, data: { connectionStatus: ConnectionStatus.CONNECTED, lastCheckedAt: checkedAt } });
      return { connected: true, connectionStatus: ConnectionStatus.CONNECTED, checkedAt };
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      await this.prisma.userPortalAccount.update({ where: { id }, data: { connectionStatus: ConnectionStatus.ERROR, lastCheckedAt: checkedAt } });
      return { connected: false, connectionStatus: ConnectionStatus.ERROR, checkedAt };
    }
  }

  private async getOwned(userId: string, id: string): Promise<AccountWithPortal> { const account = await this.prisma.userPortalAccount.findFirst({ where: { id, userId }, include: accountInclude }); if (!account) throw new NotFoundException('Portal hesabı bulunamadı.'); return account; }
}

function toResponse(account: AccountWithPortal): UserPortalAccountResponseDto { return { id: account.id, connectionStatus: account.connectionStatus, lastCheckedAt: account.lastCheckedAt, portal: account.portal }; }
function isUniqueViolation(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
