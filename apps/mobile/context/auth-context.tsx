import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, authLogin, AuthTokens, refreshTokens, User } from '@/lib/api';

const ACCESS_KEY = 'tiklayayinla.mobile.access-token';
const REFRESH_KEY = 'tiklayayinla.mobile.refresh-token';

type AuthContextValue = { user: User | null; ready: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; request: (path: string, init?: RequestInit) => Promise<Response> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const persist = useCallback(async (next: AuthTokens) => { await Promise.all([SecureStore.setItemAsync(ACCESS_KEY, next.accessToken), SecureStore.setItemAsync(REFRESH_KEY, next.refreshToken)]); setTokens(next); }, []);
  const clear = useCallback(async () => { await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]); setTokens(null); setUser(null); }, []);

  useEffect(() => { let mounted = true; (async () => { const [accessToken, refreshToken] = await Promise.all([SecureStore.getItemAsync(ACCESS_KEY), SecureStore.getItemAsync(REFRESH_KEY)]); if (!mounted) return; if (accessToken && refreshToken) { setTokens({ accessToken, refreshToken }); try { const response = await apiRequest('users/me', accessToken); if (response.ok) setUser(await response.json()); else if (response.status === 401) { const fresh = await refreshTokens(refreshToken); await persist(fresh); const me = await apiRequest('users/me', fresh.accessToken); if (me.ok) setUser(await me.json()); } } catch { await clear(); } } setReady(true); })(); return () => { mounted = false; }; }, [clear, persist]);

  const signIn = useCallback(async (email: string, password: string) => { const result = await authLogin(email, password); await persist(result.tokens); setUser(result.user); }, [persist]);
  const signOut = useCallback(async () => { if (tokens?.refreshToken) await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) }).catch(() => undefined); await clear(); }, [clear, tokens]);
  const request = useCallback(async (path: string, init?: RequestInit) => { if (!tokens) throw new Error('Oturum bulunamadı.'); let response = await apiRequest(path, tokens.accessToken, init); if (response.status === 401) { try { const fresh = await refreshTokens(tokens.refreshToken); await persist(fresh); response = await apiRequest(path, fresh.accessToken, init); } catch { await clear(); } } return response; }, [clear, persist, tokens]);
  const value = useMemo(() => ({ user, ready, signIn, signOut, request }), [ready, request, signIn, signOut, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth AuthProvider içinde kullanılmalıdır.'); return context; }
