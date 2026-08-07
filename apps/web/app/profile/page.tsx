'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../../src/lib/api-client';
import { type OrganizationType } from '../../src/lib/sector';
import { getOrganizationApplicationViewState, type OrganizationApplicationItem } from '../../src/lib/organization-applications';
import { AppNavigation } from '../../src/components/navigation/app-navigation';
import { buildProfileOrganizationSummary, getEidsInformationMessage } from '../../src/lib/profile-summary';

type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  status: string;
  organization?: {
    organizationId: string | null;
    organizationName: string | null;
    organizationType: OrganizationType | null;
    membershipRole: string | null;
    membershipStatus: string | null;
  } | null;
};

const organizationTypeLabels: Record<string, string> = {
  REAL_ESTATE_AGENCY: 'Emlak Ofisi',
  AUTO_DEALER: 'Galeri / Otomotiv',
  OTHER: 'Diğer',
};

const organizationRoleLabels: Record<string, string> = {
  OWNER: 'Yetkili',
  MANAGER: 'Yönetici',
  MEMBER: 'Üye',
};

const membershipStatusLabels: Record<string, string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
};

function errorMessage(status: number) {
  if (status === 401) return 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';
  if (status === 404) return 'Profil bilgileri bulunamadı.';
  if (status === 422) return 'Ad, soyad ve telefon bilgilerini kontrol edin.';
  if (status >= 500) return 'Profil işlemi şu anda tamamlanamadı. Lütfen tekrar deneyin.';
  return 'Profil işlemi tamamlanamadı.';
}

async function safeError(response: Response) {
  try {
    const data = await response.json();
    const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    return typeof message === 'string' && message.length < 300 ? message : errorMessage(response.status);
  } catch {
    return errorMessage(response.status);
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<OrganizationApplicationItem[]>([]);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const applicationViewState = useMemo(() => getOrganizationApplicationViewState(applications), [applications]);
  const organizationSummary = useMemo(() => profile ? buildProfileOrganizationSummary(profile, applications) : null, [applications, profile]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [profileResponse, applicationsResponse] = await Promise.all([
        authenticatedFetch('users/me'),
        authenticatedFetch('organizations/applications'),
      ]);
      if (!profileResponse.ok) throw new Error(await safeError(profileResponse));
      if (!applicationsResponse.ok) throw new Error('Kurumsal başvuru durumu alınamadı.');
      const profileData = await profileResponse.json() as Profile;
      const applicationData = await applicationsResponse.json() as OrganizationApplicationItem[];
      setProfile(profileData);
      setApplications(applicationData);
      setForm({ firstName: profileData.firstName ?? '', lastName: profileData.lastName ?? '', phone: profileData.phone ?? '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profil bilgileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch('users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone.trim() === '' ? null : form.phone,
        }),
      });
      if (!response.ok) throw new Error(await safeError(response));
      const data = await response.json() as Profile;
      setProfile(data);
      setForm({ firstName: data.firstName ?? '', lastName: data.lastName ?? '', phone: data.phone ?? '' });
      setNotice('Profil başarıyla güncellendi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="mx-auto max-w-5xl"><div className="h-10 w-48 animate-pulse rounded bg-slate-200" /><div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /></div></div></main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">PROFİL</p>
          <h1 className="mt-1 text-3xl font-bold">Profil</h1>
          <p className="mt-2 text-slate-600">Hesap bilgilerinizi yönetin.</p>
        </div>
        <AppNavigation activeHref="/profile" role={profile?.role ?? null} />
      </header>

      {error && <section className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold hover:bg-red-100" onClick={() => void load()} type="button">Tekrar dene</button></section>}
      {notice && <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <div className="mb-5">
        <OrganizationApplicationActionLink badge={applicationViewState.badge} href="/organization-applications" />
      </div>

      {profile && <form onSubmit={submit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Yetkili Bilgileri</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">Ad<input className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" maxLength={50} minLength={2} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} required value={form.firstName} /></label>
              <label className="block text-sm font-semibold">Soyad<input className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" maxLength={50} minLength={2} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required value={form.lastName} /></label>
              <label className="block text-sm font-semibold">E-posta<input className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-normal text-slate-600" readOnly value={profile.email} /></label>
              <label className="block text-sm font-semibold">Telefon<input className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} value={form.phone} /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Kurumsal Bilgiler</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="font-semibold text-slate-500">Firma adı</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.organizationName ?? 'Kurumsal bilgi yok'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Firma türü</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.organizationType ? organizationTypeLabels[profile.organization.organizationType] ?? profile.organization.organizationType : '—'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Organizasyon rolü</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.membershipRole ? organizationRoleLabels[profile.organization.membershipRole] ?? profile.organization.membershipRole : '—'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Üyelik durumu</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.membershipStatus ? membershipStatusLabels[profile.organization.membershipStatus] ?? profile.organization.membershipStatus : '—'}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Kurumsal Hesap Özeti</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="font-semibold text-slate-500">Kurumsal hesap durumu</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.accountStatus ?? '—'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Kurum adı</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.organizationName ?? '—'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Sektör</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.organizationType ?? '—'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Kurumdaki rol</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.organizationRole ?? '—'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Başvuru durumu</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.applicationStatus ?? applicationViewState.badge}</dd></div>
              <div><dt className="font-semibold text-slate-500">Onay tarihi</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.approvalDate ?? '—'}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">EİDS Doğrulaması</h2>
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{getEidsInformationMessage()}</p>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </form>}
    </div>
  </main>;
}

function OrganizationApplicationActionLink({ href, badge }: { href: string; badge: string }) {
  const badgeClass = badge === 'Onaylandı'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : badge === 'İncelemede'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : badge === 'Reddedildi'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-slate-200 bg-slate-50 text-slate-700';

  return <Link className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-50" href={href}>
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-white" aria-hidden="true">
      <svg fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 21V7.5L12 3l8 4.5V21H4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M9 21v-6h6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    </span>
    <span className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-slate-900">Kurumsal Başvuru</span>
      <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass}`}>{badge}</span>
    </span>
  </Link>;
}
