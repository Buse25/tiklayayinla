const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_URL = configuredApiUrl ? configuredApiUrl.replace(/\/$/, '') : '';
const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();
export const WEB_URL = (configuredWebUrl || API_URL.replace(/:\d+(\/api\/v1)?$/, ':3000') || 'http://localhost:3000').replace(/\/$/, '');

function requireApiUrl(): string {
  if (!API_URL) throw new Error('API adresi ayarlı değil. Fiziksel cihaz için EXPO_PUBLIC_API_URL değerini yerel ağ IP adresiyle tanımlayın.');
  return API_URL;
}

export type AuthTokens = { accessToken: string; refreshToken: string };

// These values are verified against apps/api/prisma/schema.prisma (UserRole).
export const UserRole = { ADMIN: 'ADMIN', USER: 'USER' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export async function authLogin(email: string, password: string): Promise<{ tokens: AuthTokens; user: User }> {
  const response = await fetch(`${requireApiUrl()}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const payload = await readPayload(response);
  if (!response.ok) throw new ApiError(response.status, payload);
  return { tokens: payload as AuthTokens, user: (payload as AuthTokens & { user: User }).user };
}

export type User = { id: string; email: string; firstName: string; lastName: string; role: UserRole; status: string };

export function isAdmin(user: User | null): boolean {
  return user?.role === UserRole.ADMIN;
}

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
