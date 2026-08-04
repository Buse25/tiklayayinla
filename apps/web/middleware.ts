import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './src/lib/auth-session';

const protectedPrefixes = ['/listings', '/dashboard'];
const authPages = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value && request.cookies.get(REFRESH_TOKEN_COOKIE)?.value);
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtected && !hasSession) return NextResponse.redirect(new URL('/login', request.url));
  if (authPages.includes(pathname) && hasSession) return NextResponse.redirect(new URL('/listings', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/listings/:path*', '/dashboard/:path*', '/login', '/register'] };
