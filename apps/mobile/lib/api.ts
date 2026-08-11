const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_URL = configuredApiUrl ? configuredApiUrl.replace(/\/$/, '') : '';

function requireApiUrl(): string {
  if (!API_URL) throw new Error('API adresi ayarlı değil. Fiziksel cihaz için EXPO_PUBLIC_API_URL değerini yerel ağ IP adresiyle tanımlayın.');
  return API_URL;
}

export type AuthTokens = { accessToken: string; refreshToken: string };

export async function authLogin(email: string, password: string): Promise<{ tokens: AuthTokens; user: User }> {
  const response = await fetch(`${requireApiUrl()}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const payload = await readPayload(response);
  if (!response.ok) throw new ApiError(response.status, payload);
  return { tokens: payload as AuthTokens, user: (payload as AuthTokens & { user: User }).user };
}

export type User = { id: string; email: string; firstName: string; lastName: string; role: string; status: string };

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const response = await fetch(`${requireApiUrl()}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  const payload = await readPayload(response);
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as AuthTokens;
}

export async function apiRequest(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${requireApiUrl()}/${path.replace(/^\//, '')}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
}

async function readPayload(response: Response): Promise<Record<string, unknown>> { return response.json().catch(() => ({})); }

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly payload: Record<string, unknown>) { super(typeof payload.message === 'string' ? payload.message : 'İstek tamamlanamadı.'); }
}
