'use client';

/**
 * Uygulama içi istekleri Next.js BFF katmanından geçirir.
 * BFF refresh token ile oturumu yenileyemezse cookie'leri temizler ve bu
 * yardımcı kullanıcıyı giriş ekranına döndürür.
 */
export async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.replace(/^\//, '');
  const response = await fetch(`/api/backend/${normalizedPath}`, init);
  if (response.status === 401) window.location.assign('/login');
  return response;
}
