import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { JwtAccessGuard } from './guards/jwt-access.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  health() { return { module: 'auth', status: 'ready' }; }

  @Post('register')
  @ApiOperation({ summary: 'Yeni kullanıcı kaydı oluşturur' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Geçersiz e-posta veya parola' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> { return this.authService.register(dto); }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'E-posta ve parola ile giriş yapar' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-posta veya parola geçersiz' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> { return this.authService.login(dto); }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh tokenı döndürür ve token çiftini yeniler' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token geçersiz, süresi dolmuş veya iptal edilmiş' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> { return this.authService.refresh(dto.refreshToken); }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Refresh tokenı iptal eder' })
  @ApiUnauthorizedResponse({ description: 'Refresh token geçersiz' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> { await this.authService.logout(dto.refreshToken); }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Oturumdaki kullanıcının güvenli profilini döndürür' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Access token geçersiz veya eksik' })
  me(@CurrentUser() user: AuthenticatedUser): UserResponseDto { return user; }
}
