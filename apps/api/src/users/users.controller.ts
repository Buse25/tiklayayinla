import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordCodeResponseDto } from './dto/password-code-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Access token geçersiz veya eksik.' })
@UseGuards(JwtAccessGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Oturumdaki kullanıcının profilini döndürür' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MyProfileResponseDto> {
    return this.users.getMyProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Oturumdaki kullanıcının ad, soyad ve telefon bilgisini günceller' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Geçersiz alan veya doğrulama hatası.' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMyProfileDto): Promise<MyProfileResponseDto> {
    return this.users.updateMyProfile(user.id, dto);
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [AdminUserResponseDto] })
  @ApiOperation({ summary: 'Kullanıcıları admin için listeler' })
  listAdminUsers(@CurrentUser() actor: AuthenticatedUser): Promise<AdminUserResponseDto[]> {
    return this.users.listAdminUsers(actor.role);
  }

  @Get('admin/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminUserResponseDto })
  @ApiOperation({ summary: 'Admin için kullanıcı detayını döndürür' })
  getAdminUser(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminUserResponseDto> {
    return this.users.getAdminUser(actor.role, id);
  }

  @Post('me/password/request-code')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ type: PasswordCodeResponseDto })
  requestPasswordCode(@CurrentUser() user: AuthenticatedUser): Promise<PasswordCodeResponseDto> { return this.users.requestPasswordCode(user.id); }

  @Post('me/password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto): Promise<void> { return this.users.changePassword(user.id, dto); }

  @Post('me/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(@CurrentUser() user: AuthenticatedUser): Promise<void> { return this.users.deleteAccount(user.id, user.role); }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateStatus(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserStatusDto): Promise<void> {
    return this.users.updateUserStatus(actor.role, id, dto);
  }

  @Post(':id/phone-verification')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiOperation({ summary: 'Bir kullanıcının telefonunu admin tarafından doğrular' })
  manuallyVerifyPhone(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<MyProfileResponseDto> {
    return this.users.manuallyVerifyPhone(actor.id, actor.role, id);
  }
}
