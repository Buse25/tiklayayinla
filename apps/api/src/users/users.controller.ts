import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { UsersService } from './users.service';

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
}
