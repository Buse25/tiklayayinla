import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialEncryptionService } from './credential-encryption.service';
import { CreateUserPortalAccountDto } from './dto/create-user-portal-account.dto';
import { UpdateUserPortalAccountDto } from './dto/update-user-portal-account.dto';
import { PortalConnectionTestResponseDto, UserPortalAccountResponseDto } from './dto/user-portal-account-response.dto';
import { PortalCatalogResponseDto } from './dto/portal-catalog-response.dto';
import { UserPortalAccountsService } from './user-portal-accounts.service';

@ApiTags('Portals')
@Controller('portals')
class PortalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Aktif portal kataloğunu credential şemalarıyla listeler' })
  @ApiOkResponse({ type: [PortalCatalogResponseDto] })
  async list(): Promise<PortalCatalogResponseDto[]> {
    return this.prisma.portal.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true, code: true, name: true, adapterKey: true, isActive: true,
        connectionType: true, credentialSchema: true, documentationUrl: true, logoUrl: true,
      },
    }).then((portals) => portals.map((portal) => ({
      ...portal,
      credentialSchema: portal.credentialSchema as unknown as PortalCatalogResponseDto['credentialSchema'],
    })));
  }
}

@ApiTags('User Portal Accounts')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('portal-accounts')
class UserPortalAccountsController {
  constructor(private readonly accounts: UserPortalAccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Kullanıcının portal hesabını oluşturur' })
  @ApiCreatedResponse({ type: UserPortalAccountResponseDto })
  @ApiConflictResponse()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserPortalAccountDto) { return this.accounts.create(user.id, dto); }

  @Get()
  @ApiOperation({ summary: 'Kullanıcının portal hesaplarını listeler' })
  @ApiOkResponse({ type: [UserPortalAccountResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser) { return this.accounts.findAll(user.id); }

  @Get(':id')
  @ApiOperation({ summary: 'Kullanıcının portal hesabı detayını getirir' })
  @ApiOkResponse({ type: UserPortalAccountResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.accounts.findOne(user.id, id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Portal credential bilgisini günceller ve bağlantıyı tekrar test edilmemiş duruma alır' })
  @ApiOkResponse({ type: UserPortalAccountResponseDto })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserPortalAccountDto) { return this.accounts.update(user.id, id, dto); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Portal hesabını siler' })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> { await this.accounts.remove(user.id, id); }

  @Post(':id/test-connection')
  @ApiOperation({ summary: 'Mock portal bağlantısını test eder' })
  @ApiOkResponse({ type: PortalConnectionTestResponseDto })
  testConnection(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.accounts.testConnection(user.id, id); }
}

@Module({ controllers: [PortalsController, UserPortalAccountsController], providers: [CredentialEncryptionService, UserPortalAccountsService] })
export class PortalsModule {}
