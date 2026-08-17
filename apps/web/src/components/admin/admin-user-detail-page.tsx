'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { canManuallyVerifyPhone, phoneVerificationMethodLabel, type AdminUser, verificationLabel } from '../../lib/admin-users';
import { AppNavigation } from '../navigation/app-navigation';
import { AppShell } from '../layout/app-shell';

export function AdminUserDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const profileResponse = await authenticatedFetch('users/me');
      if (!profileResponse.ok) throw new Error('Profil bilgisi alınamadı.');
      const profile = await profileResponse.json() as { role: string };
      if (profile.role !== 'ADMIN') { router.push('/dashboard'); return; }
      const response = await authenticatedFetch(`users/admin/${id}`);
      if (!response.ok) throw new Error(response.status === 404 ? 'Kullanıcı bulunamadı.' : 'Kullanıcı detayı alınamadı.');
      setUser(await response.json() as AdminUser);
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Kullanıcı detayı alınamadı.'); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  async function verifyPhone() {
    if (!user || !canManuallyVerifyPhone(user) || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await authenticatedFetch(`users/${user.id}/phone-verification`, { method: 'POST' });
      if (!response.ok) throw new Error(await readMessage(response, 'Telefon doğrulanamadı.'));
      setNotice('Telefon numarası manuel olarak doğrulandı.');
      await load();
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Telefon doğrulanamadı.'); }
    finally { setSaving(false); }
  }

  return <AppShell><main className="mx-auto max-w-5xl p-6"><AppNavigation role="ADMIN" activeHref="/admin/users" /><div className="mt-6"><Link className="text-sm font-semibold text-teal-700 hover:underline" href="/admin/users">← Kullanıcılara dön</Link><p className="mt-4 text-sm font-semibold text-teal-700">KULLANICI DETAYI</p><h1 className="mt-1 text-3xl font-bold">{user ? `${user.firstName} ${user.lastName}` : 'Kullanıcı'}</h1></div>{loading && <p className="mt-6 text-sm text-slate-500">Kullanıcı yükleniyor...</p>}{error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}{user && <div className="mt-6 grid gap-6 md:grid-cols-2"><InfoSection title="Hesap Bilgileri"><InfoRow label="Ad Soyad" value={`${user.firstName} ${user.lastName}`} /><InfoRow label="E-posta" value={user.email} /><InfoRow label="Telefon" value={user.phone ?? '—'} /><InfoRow label="Rol" value={user.role} /><InfoRow label="Durum" value={user.status} /><InfoRow label="Kayıt tarihi" value={formatDate(user.createdAt)} /></InfoSection><InfoSection title="Hesap Doğrulamaları"><InfoRow label="E-posta" value={verificationLabel(user.emailVerified)} /><InfoRow label="E-posta doğrulama tarihi" value={formatOptionalDate(user.emailVerifiedAt)} /><InfoRow label="Telefon" value={verificationLabel(user.phoneVerified)} /><InfoRow label="Telefon doğrulama tarihi" value={formatOptionalDate(user.phoneVerifiedAt)} /><InfoRow label="Doğrulama yöntemi" value={phoneVerificationMethodLabel(user.phoneVerificationMethod)} />{canManuallyVerifyPhone(user) && <button className="mt-4 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={() => void verifyPhone()}>{saving ? 'Doğrulanıyor...' : 'Telefonu Manuel Doğrula'}</button>}</InfoSection><InfoSection title="EİDS Doğrulaması"><InfoRow label="Durum" value={user.eidsStatus} /><InfoRow label="Doğrulama kaynağı" value={user.eidsVerificationMethod === 'EIDS' ? 'EİDS' : user.eidsVerificationMethod === 'ADMIN_TEST' ? 'Admin test' : '—'} /><InfoRow label="Doğrulama tarihi" value={formatOptionalDate(user.eidsVerifiedAt)} /></InfoSection><InfoSection title="Kurumsal Durum"><InfoRow label="Son başvuru" value={user.latestApplicationStatus ?? 'Başvuru yok'} /><InfoRow label="Kurum" value={user.organization?.name ?? '—'} /></InfoSection></div>}</main></AppShell>;
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-800">{value}</span></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value)); }
function formatOptionalDate(value: string | null) { return value ? formatDate(value) : '—'; }
async function readMessage(response: Response, fallback: string) { try { const payload = await response.json() as { message?: string | string[] }; return Array.isArray(payload.message) ? payload.message.join(', ') : payload.message ?? fallback; } catch { return fallback; } }
