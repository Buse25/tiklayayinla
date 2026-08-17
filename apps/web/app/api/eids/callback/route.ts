import { NextRequest, NextResponse } from 'next/server';
import { apiUrl } from '../../../../src/lib/auth-session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const target = new URL(apiUrl('/eids/callback'));
  target.searchParams.set('yetkiKodu', request.nextUrl.searchParams.get('yetkiKodu') ?? '');
  target.searchParams.set('durum', request.nextUrl.searchParams.get('durum') ?? '');
  const correlationCookie = request.cookies.get('tiklayayinla_eids_correlation')?.value;

  try {
    const upstream = await fetch(target, { headers: correlationCookie ? { Cookie: `tiklayayinla_eids_correlation=${encodeURIComponent(correlationCookie)}` } : {}, redirect: 'manual', cache: 'no-store' });
    const location = upstream.headers.get('location');
    const response = location ? NextResponse.redirect(location, { status: 302 }) : NextResponse.redirect(new URL('/profile?eids=failed', request.url));
    response.cookies.set('tiklayayinla_eids_correlation', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/eids/callback', maxAge: 0 });
    return response;
  } catch {
    const response = NextResponse.redirect(new URL('/profile?eids=failed', request.url));
    response.cookies.set('tiklayayinla_eids_correlation', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/eids/callback', maxAge: 0 });
    return response;
  }
}
