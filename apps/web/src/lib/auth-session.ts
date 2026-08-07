import { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE = 'tiklayayinla_access_token';
export const REFRESH_TOKEN_COOKIE = 'tiklayayinla_refresh_token';

const accessTokenMaxAge = 15 * 60;
const refreshTokenMaxAge = 30 * 24 * 60 * 60;

export type AuthTokens = { accessToken: string; refreshToken: string };

export function apiUrl(path: string): string {
  const baseUrl = process.env.API_URL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : undefined);
  if (!baseUrl) throw new Error('API_URL veya NEXT_PUBLIC_API_URL tanımlı değil.');
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function setSessionCookies(response: NextResponse, tokens: AuthTokens): void {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: accessTokenMaxAge });
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: refreshTokenMaxAge });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}
