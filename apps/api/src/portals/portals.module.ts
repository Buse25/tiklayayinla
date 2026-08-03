import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AdapterRegistry } from '../publishing/adapter.registry';
import { CredentialEncryptionService } from './credential-encryption.service';
import { CreateUserPortalAccountDto } from './dto/create-user-portal-account.dto';
import { UpdateUserPortalAccountDto } from './dto/update-user-portal-account.dto';
import { PortalConnectionTestResponseDto, UserPortalAccountResponseDto } from './dto/user-portal-account-response.dto';
import { UserPortalAccountsService } from './user-portal-accounts.service';

@Controller('portals')
class PortalsController { constructor(private readonly registry: AdapterRegistry) {} @Get() list() { return this.registry.list(); } }

@ApiTags('User Portal Accounts')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('portal-accounts')
class UserPortalAccountsController {
  constructor(private readonly accounts: UserPortalAccountsService) {}
  @Post() @ApiOperation({ summary: 'Kullanıcının portal hesabını oluşturur' }) @ApiCreatedResponse({ type: UserPortalAccountResponseDto }) @ApiConflictResponse() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserPortalAccountDto) { return this.accounts.create(user.id, dto); }
  @Get() @ApiOperation({ summary: 'Kullanıcının portal hesaplarını listeler' }) @ApiOkResponse({ type: [UserPortalAccountResponseDto] }) findAll(@CurrentUser() user: AuthenticatedUser) { return this.accounts.findAll(user.id); }
  @Patch(':id') @ApiOperation({ summary: 'Portal credential bilgisini günceller ve bağlantıyı tekrar beklemeye alır' }) @ApiOkResponse({ type: UserPortalAccountResponseDto }) update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserPortalAccountDto) { return this.accounts.update(user.id, id, dto); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Portal hesabını siler' }) @ApiNoContentResponse() async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> { await this.accounts.remove(user.id, id); }
  @Post(':id/test-connection') @ApiOperation({ summary: 'mock-rest veya mock-xml portal hesabının bağlantısını test eder' }) @ApiOkResponse({ type: PortalConnectionTestResponseDto }) testConnection(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.accounts.testConnection(user.id, id); }
}

@Module({ controllers: [PortalsController, UserPortalAccountsController], providers: [CredentialEncryptionService, UserPortalAccountsService] })
export class PortalsModule {}
