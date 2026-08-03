import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, apiUrl, clearSessionCookies, setSessionCookies, type AuthTokens } from '../../../../src/lib/auth-session';

export const runtime = 'nodejs';

const supportedActions = new Set(['login', 'register', 'refresh', 'logout']);

export async function POST(request: NextRequest, { params }: { params: { action: string } }) {
  const action = params.action;
  if (!supportedActions.has(action)) return NextResponse.json({ message: 'Bulunamadı.' }, { status: 404 });

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

    const payload = await upstream.json();
    if (!upstream.ok) {
      const response = NextResponse.json(payload, { status: upstream.status });
      if (action === 'refresh') clearSessionCookies(response);
      return response;
    }

    const tokens = payload as AuthTokens;
    const response = NextResponse.json({ user: payload.user });
    setSessionCookies(response, tokens);
    return response;
  } catch {
    if (action === 'logout') {
      const response = NextResponse.json({ message: 'Çıkış oturumu yerelde temizlendi.' }, { status: 503 });
      clearSessionCookies(response);
      return response;
    }
    return NextResponse.json({ message: 'Kimlik doğrulama servisine ulaşılamadı.' }, { status: 503 });
  }
}
