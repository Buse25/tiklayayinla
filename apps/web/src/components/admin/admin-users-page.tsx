'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { type AdminUser, verificationLabel } from '../../lib/admin-users';
import { AppNavigation } from '../navigation/app-navigation';
import { AppShell } from '../layout/app-shell';

type Profile = { role: string };

export function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const profileResponse = await authenticatedFetch('users/me');
      if (!profileResponse.ok) throw new Error('Profil bilgisi alınamadı.');
      const profile = await profileResponse.json() as Profile;
      if (profile.role !== 'ADMIN') { router.push('/dashboard'); return; }
      const response = await authenticatedFetch('users/admin');
      if (!response.ok) throw new Error('Kullanıcılar yüklenemedi.');
      setUsers(await response.json() as AdminUser[]);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Kullanıcılar yüklenemedi.');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  return <AppShell><main className="mx-auto max-w-7xl p-6">
    <AppNavigation role="ADMIN" activeHref="/admin/users" />
    <div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">ADMİN PANELİ</p><h1 className="mt-1 text-3xl font-bold">Kullanıcılar</h1></div><p className="text-sm text-slate-500">{users.length} kullanıcı</p></div>
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
      {loading ? <p className="p-6 text-sm text-slate-500">Kullanıcılar yükleniyor...</p> : <table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Kullanıcı', 'E-posta', 'Telefon', 'E-posta Durumu', 'Telefon Durumu', 'Rol', 'Kayıt Tarihi', 'Detay'].map((heading) => <th className="px-4 py-3" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y">{users.map((user) => <tr className="hover:bg-teal-50/40" key={user.id}><td className="px-4 py-4 font-semibold">{user.firstName} {user.lastName}</td><td className="px-4 py-4">{user.email}</td><td className="px-4 py-4">{user.phone ?? '—'}</td><td className="px-4 py-4"><StatusBadge verified={user.emailVerified} /></td><td className="px-4 py-4"><StatusBadge verified={user.phoneVerified} /></td><td className="px-4 py-4">{user.role}</td><td className="px-4 py-4 whitespace-nowrap">{formatDate(user.createdAt)}</td><td className="px-4 py-4"><Link className="font-semibold text-teal-700 hover:underline" href={`/admin/users/${user.id}`}>Görüntüle</Link></td></tr>)}</tbody></table>}
      {!loading && users.length === 0 && !error && <p className="p-6 text-sm text-slate-500">Kullanıcı bulunamadı.</p>}
    </section>
  </main></AppShell>;
}

function StatusBadge({ verified }: { verified: boolean }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{verificationLabel(verified)}</span>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value)); }
