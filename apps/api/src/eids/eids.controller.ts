import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { EIDS_CORRELATION_COOKIE, EidsService } from './eids.service';

@ApiTags('EİDS')
@Controller('eids')
export class EidsController {
  constructor(private readonly eids: EidsService, private readonly config: ConfigService) {}

  @Post('authorize')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'EİDS doğrulama oturumunu başlatır' })
  @ApiOkResponse({ schema: { properties: { authorizeUrl: { type: 'string', format: 'uri' } } } })
  async authorize(@CurrentUser() user: AuthenticatedUser, @Res() response: Response): Promise<void> {
    const result = await this.eids.createAuthorizeSession(user.id);
    response.cookie(EIDS_CORRELATION_COOKIE, result.correlationToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/eids/callback', maxAge: result.maxAge * 1000 });
    response.json({ authorizeUrl: result.authorizeUrl });
  }

  @Get('callback')
  @ApiOperation({ summary: 'EİDS callback endpointi' })
  async callback(@Query('yetkiKodu') yetkiKodu: string | undefined, @Query('durum') durum: string | undefined, @Res() response: Response): Promise<void> {
    const token = parseCookie(response.req.headers.cookie, EIDS_CORRELATION_COOKIE);
    const result = await this.eids.handleCallback(token, yetkiKodu, durum);
    response.clearCookie(EIDS_CORRELATION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/eids/callback' });
    response.redirect(302, this.profileRedirect(result));
  }

  private profileRedirect(result: 'success' | 'failed' | 'incomplete'): string {
    const base = this.config.get<string>('WEB_URL') ?? this.config.get<string>('APP_URL');
    if (!base) throw new Error('WEB_URL veya APP_URL environment variable must be set.');
    return `${base.replace(/\/$/, '')}/profile?eids=${result}`;
  }
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : undefined;
}
