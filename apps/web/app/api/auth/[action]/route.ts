import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_TOKEN_COOKIE, apiUrl, clearSessionCookies, setSessionCookies, type AuthTokens } from '../../../../src/lib/auth-session';

export const runtime = 'nodejs';

const sessionActions = new Set(['login', 'refresh', 'verify-email', 'google']);
const postOnlyActions = new Set(['login', 'register', 'refresh', 'logout', 'verify-email', 'resend-verification', 'forgot-password', 'reset-password', 'google']);

export async function GET(request: NextRequest, { params }: { params: { action: string } }) {
  if (params.action !== 'verification-status') return NextResponse.json({ message: 'Bulunamadı.' }, { status: 404 });

  const verificationContext = request.headers.get('x-verification-context') ?? undefined;
  const email = request.headers.get('x-verification-email') ?? undefined;

  try {
    const upstream = await fetch(apiUrl('/auth/verification-status'), {
      method: 'GET',
      headers: {
        ...(verificationContext ? { 'x-verification-context': verificationContext } : {}),
        ...(email ? { 'x-verification-email': email } : {}),
      },
      cache: 'no-store',
    });
    const payload = await upstream.json();
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ message: 'Kimlik doğrulama servisine ulaşılamadı.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { action: string } }) {
  const action = params.action;
  if (!postOnlyActions.has(action)) return NextResponse.json({ message: 'Bulunamadı.' }, { status: 404 });

  const body = action === 'refresh' || action === 'logout'
    ? { refreshToken: request.cookies.get(REFRESH_TOKEN_COOKIE)?.value }
    : await request.json();

  if (!body.refreshToken && (action === 'refresh' || action === 'logout')) {
    const response = NextResponse.json({ message: 'Oturum bulunamadı.' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  try {
    const upstream = await fetch(apiUrl(`/auth/${action}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (action === 'logout') {
      const response = new NextResponse(null, { status: upstream.ok ? 204 : upstream.status });
      clearSessionCookies(response);
      return response;
    }

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const payload = await upstream.json();
    if (!upstream.ok) {
      const response = NextResponse.json(payload, { status: upstream.status });
      if (action === 'refresh' || action === 'verify-email') clearSessionCookies(response);
      return response;
    }

    if (sessionActions.has(action)) {
      const tokens = payload as AuthTokens;
      const response = NextResponse.json({ user: payload.user });
      setSessionCookies(response, tokens);
      return response;
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    if (action === 'logout') {
      const response = NextResponse.json({ message: 'Çıkış oturumu yerelde temizlendi.' }, { status: 503 });
      clearSessionCookies(response);
      return response;
    }
    return NextResponse.json({ message: 'Kimlik doğrulama servisine ulaşılamadı.' }, { status: 503 });
  }
}
