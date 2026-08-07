import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { ResendVerificationDto, VerificationActionResponseDto, VerificationRequiredResponseDto, VerificationStatusResponseDto, VerifyEmailDto } from './dto/verification.dto';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { EmailVerificationService } from './email-verification.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly emailVerificationService: EmailVerificationService) {}

  @Get('health')
  health() { return { module: 'auth', status: 'ready' }; }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Yeni kullanıcı kaydı oluşturur ve doğrulama kodu gönderir' })
  @ApiCreatedResponse({ type: VerificationRequiredResponseDto, description: 'Kullanıcı oluşturuldu ve e-posta doğrulaması gerekiyor.' })
  @ApiConflictResponse({ description: 'E-posta adresi zaten kullanılıyor.' })
  @ApiUnprocessableEntityResponse({ description: 'Geçersiz kullanıcı veya organizasyon alanı.' })
  @ApiUnprocessableEntityResponse({ description: 'Geçersiz e-posta veya parola' })
  @ApiTooManyRequestsResponse({ description: 'Bir dakika içinde en fazla 5 kayıt isteği gönderilebilir.' })
  async register(@Body() dto: RegisterDto): Promise<VerificationRequiredResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'E-posta ve parola ile giriş yapar' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-posta veya parola geçersiz' })
  @ApiTooManyRequestsResponse({ description: 'Bir dakika içinde en fazla 10 giriş isteği gönderilebilir.' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> { return this.authService.login(dto); }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh tokenı döndürür ve token çiftini yeniler' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token geçersiz, süresi dolmuş veya iptal edilmiş' })
  @ApiTooManyRequestsResponse({ description: 'Bir dakika içinde en fazla 20 token yenileme isteği gönderilebilir.' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> { return this.authService.refresh(dto.refreshToken); }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Refresh tokenı iptal eder' })
  @ApiUnauthorizedResponse({ description: 'Refresh token geçersiz' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> { await this.authService.logout(dto.refreshToken); }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'E-posta doğrulama kodunu doğrular ve oturum açar' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Doğrulama kodu geçersiz veya süresi dolmuş.' })
  @ApiConflictResponse({ description: 'E-posta zaten doğrulanmış.' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthResponseDto> {
    const target = await this.emailVerificationService.verifyCode(dto);
    return this.authService.createSessionForUserId(target.userId);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Doğrulama kodunu tekrar gönderir' })
  @ApiOkResponse({ type: VerificationActionResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Yeniden gönderim için beklemeniz gerekiyor.' })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<VerificationActionResponseDto> {
    return this.emailVerificationService.resendCode(dto);
  }

  @Get('verification-status')
  @ApiOperation({ summary: 'Doğrulama durumunu döndürür' })
  @ApiOkResponse({ type: VerificationStatusResponseDto })
  async verificationStatus(@Headers('x-verification-context') verificationContext?: string, @Headers('x-verification-email') email?: string): Promise<VerificationStatusResponseDto> {
    return this.emailVerificationService.getStatus({ verificationContext, email });
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Oturumdaki kullanıcının güvenli profilini döndürür' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Access token geçersiz veya eksik' })
  me(@CurrentUser() user: AuthenticatedUser): UserResponseDto { return user; }
}
