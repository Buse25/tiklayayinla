import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, apiUrl, clearSessionCookies, setSessionCookies, type AuthTokens } from '../../../../src/lib/auth-session';

export const runtime = 'nodejs';

async function refreshSession(refreshToken: string): Promise<AuthTokens | null> {
  const response = await fetch(apiUrl('/auth/refresh'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }), cache: 'no-store' });
  return response.ok ? response.json() as Promise<AuthTokens> : null;
}

type RouteContext = { params: { path: string[] } };

async function proxy(request: NextRequest, { params }: RouteContext) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!accessToken || !refreshToken) {
    const response = NextResponse.json({ message: 'Oturum gerekli.' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  try {
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const target = apiUrl(`/${params.path.join('/')}${request.nextUrl.search}`);
  const forward = (token: string) => fetch(target, { method: request.method, headers: { Authorization: `Bearer ${token}`, ...(request.headers.get('content-type') && { 'Content-Type': request.headers.get('content-type')! }) }, body, cache: 'no-store' });

  let upstream = await forward(accessToken);
  let freshTokens: AuthTokens | null = null;
  if (upstream.status === 401) {
    freshTokens = await refreshSession(refreshToken);
    if (!freshTokens) {
      const response = NextResponse.json({ message: 'Oturum süresi doldu.' }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }
    upstream = await forward(freshTokens.accessToken);
  }

  if (upstream.status === 204) {
    const response = new NextResponse(null, { status: 204 });
    if (freshTokens) setSessionCookies(response, freshTokens);
    return response;
  }

  const data = await upstream.arrayBuffer();
  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
  };

  const contentDisposition = upstream.headers.get('content-disposition');
  if (contentDisposition) {
    headers['Content-Disposition'] = contentDisposition;
  }

  const cacheControl = upstream.headers.get('cache-control');
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }

  const response = new NextResponse(data, { status: upstream.status, headers });
  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) response.headers.set('set-cookie', setCookie);
  if (freshTokens) setSessionCookies(response, freshTokens);
  return response;
  } catch {
    return NextResponse.json({ message: 'İstek şu anda tamamlanamadı. Lütfen tekrar deneyin.' }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
