'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../../src/lib/api-client';
import { type OrganizationType } from '../../src/lib/sector';
import { getOrganizationApplicationViewState, type OrganizationApplicationItem } from '../../src/lib/organization-applications';
import { AppShell } from '../../src/components/layout/app-shell';
import { buildProfileOrganizationSummary, canStartEidsAuthorization, getEidsCardState } from '../../src/lib/profile-summary';

type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  phoneVerificationMethod: 'ADMIN' | 'OTP' | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  eids: {
    configured: boolean;
    status: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';
    verified: boolean;
    verifiedAt: string | null;
    verificationMethod: 'EIDS' | 'ADMIN_TEST' | null;
  };
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  organization?: {
    organizationId: string | null;
    organizationName: string | null;
    organizationType: OrganizationType | null;
    membershipRole: string | null;
    membershipStatus: string | null;
  } | null;
  currentPlan?: {
    id: string;
    name: string;
    status: string;
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

function formatApiMessage(message: string | string[] | undefined, fallback: string) {
  return Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : fallback;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<OrganizationApplicationItem[]>([]);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpState, setOtpState] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);
  const [otpNow, setOtpNow] = useState(Date.now());

  const applicationViewState = useMemo(() => getOrganizationApplicationViewState(applications), [applications]);
  const organizationSummary = useMemo(() => profile ? buildProfileOrganizationSummary(profile, applications) : null, [applications, profile]);
  const eidsCard = useMemo(() => {
    if (!profile) return null;
    return { ...getEidsCardState(profile.eids, profile.phoneVerified, profile.phoneVerificationMethod, Boolean(profile.phone)), showAction: false };
  }, [profile]);
  const canStartEids = profile ? canStartEidsAuthorization(profile.eids, profile.phoneVerified, profile.phoneVerificationMethod) : false;

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
      setProfile(profileData);
      setApplications(await applicationsResponse.json() as OrganizationApplicationItem[]);
      setForm({ firstName: profileData.firstName ?? '', lastName: profileData.lastName ?? '', phone: profileData.phone ?? '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profil bilgileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!otpCooldownUntil) return;
    const timer = window.setInterval(() => setOtpNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldownUntil]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('eids');
    if (result === 'incomplete') setError('EİDS doğrulaması henüz tamamlanamadı. Entegrasyonun servis doğrulama adımı bekleniyor.');
    if (result === 'success') setNotice('EİDS kimlik doğrulamanız başarıyla tamamlandı.');
    if (result === 'failed') setError('EİDS kimlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.');
    if (result === 'success' || result === 'failed') window.history.replaceState({}, '', '/profile');
  }, []);

  async function startEidsAuthorization() {
    if (!canStartEids) return;
    setError('');
    try {
      const response = await authenticatedFetch('eids/authorize', { method: 'POST' });
      const payload = await response.json().catch(() => null) as { authorizeUrl?: string; message?: string } | null;
      if (!response.ok || !payload?.authorizeUrl) throw new Error(typeof payload?.message === 'string' ? payload.message : 'EİDS doğrulaması başlatılamadı.');
      window.location.assign(payload.authorizeUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'EİDS doğrulaması başlatılamadı.');
    }
  }

  async function requestPhoneOtp() {
    if (!profile?.phone || otpState === 'sending' || (otpCooldownUntil !== null && otpCooldownUntil > otpNow)) return;
    setOtpState('sending'); setOtpMessage('');
    try {
      const response = await authenticatedFetch('auth/phone-verification/request', { method: 'POST' });
      const payload = await response.json().catch(() => null) as { message?: string | string[]; resendAvailableAt?: string } | null;
      if (!response.ok) throw new Error(formatApiMessage(payload?.message, 'SMS doğrulama kodu gönderilemedi.'));
      setOtpCooldownUntil(payload?.resendAvailableAt ? new Date(payload.resendAvailableAt).getTime() : Date.now() + 60_000);
      setOtpState('sent'); setOtpCode(''); setOtpMessage('Doğrulama kodu telefonunuza gönderildi.');
    } catch (exception) { setOtpState('error'); setOtpMessage(exception instanceof Error ? exception.message : 'SMS doğrulama kodu gönderilemedi.'); }
  }

  async function verifyPhoneOtp() {
    if (otpCode.length !== 6 || otpState === 'verifying') return;
    setOtpState('verifying'); setOtpMessage('');
    try {
      const response = await authenticatedFetch('auth/phone-verification/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: otpCode }) });
      const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
      if (!response.ok) throw new Error(formatApiMessage(payload?.message, 'Doğrulama kodu geçersiz.'));
      setOtpState('idle'); setOtpCode(''); setOtpMessage('Telefon numaranız SMS OTP ile doğrulandı.');
      await load();
    } catch (exception) { setOtpState('error'); setOtpMessage(exception instanceof Error ? exception.message : 'Doğrulama kodu geçersiz.'); }
  }

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
      window.dispatchEvent(new Event('profile-updated'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="p-md max-w-[1600px] mx-auto text-slate-900"><div className="h-10 w-48 animate-pulse rounded bg-slate-200" /><div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /></div></div></AppShell>;

  const isCorporate = !!profile?.organization?.organizationId || applications.length > 0;

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr));
    } catch {
      return '—';
    }
  };

  return (
    <AppShell>
      <div className="p-md max-w-[1600px] mx-auto text-slate-900">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">PROFİL</p>
            <h1 className="mt-1 text-3xl font-bold">Profil</h1>
            <p className="mt-2 text-slate-600">Hesap bilgilerinizi yönetin.</p>
          </div>
        </header>

      {error && <section className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold hover:bg-red-100" onClick={() => void load()} type="button">Tekrar dene</button></section>}
      {notice && <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <div className="mb-5">
        <OrganizationApplicationActionLink badge={applicationViewState.badge} href="/organization-applications" />
      </div>

      {profile && <form onSubmit={submit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Yetkili Bilgileri */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Yetkili Bilgileri</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">Ad<input className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" maxLength={50} minLength={2} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} required value={form.firstName} /></label>
              <label className="block text-sm font-semibold">Soyad<input className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" maxLength={50} minLength={2} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required value={form.lastName} /></label>
              <label className="block text-sm font-semibold">E-posta<input className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-normal text-slate-600" readOnly value={profile.email} /></label>
              <label className="block text-sm font-semibold">Telefon<input className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} value={form.phone} /></label>
              {profile.phone && (!profile.phoneVerified || profile.phoneVerificationMethod === 'ADMIN') && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={otpState === 'sending' || (otpCooldownUntil !== null && otpCooldownUntil > otpNow)} onClick={() => void requestPhoneOtp()} type="button">{otpState === 'sending' ? 'SMS gönderiliyor...' : otpCooldownUntil && otpCooldownUntil > otpNow ? `Tekrar gönder (${Math.ceil((otpCooldownUntil - otpNow) / 1000)} sn)` : 'Telefonu Doğrula'}</button>{(otpState === 'sent' || otpState === 'verifying' || otpState === 'error') && <div className="mt-3 flex gap-2"><input aria-label="SMS doğrulama kodu" className="w-36 rounded-lg border border-slate-300 p-2 font-normal tracking-[0.3em]" inputMode="numeric" maxLength={6} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 hane" value={otpCode} /><button className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-700 disabled:opacity-50" disabled={otpCode.length !== 6 || otpState === 'verifying'} onClick={() => void verifyPhoneOtp()} type="button">{otpState === 'verifying' ? 'Doğrulanıyor...' : 'Doğrula'}</button></div>}{otpMessage && <p className={`mt-2 text-xs ${otpState === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{otpMessage}</p>}</div>}
              {profile.phoneVerified && profile.phoneVerificationMethod === 'ADMIN' && <p className="text-xs text-amber-700">Telefon admin tarafından manuel doğrulandı. EİDS için SMS doğrulaması gereklidir.</p>}
            </div>
          </section>

          {/* Hesap Bilgileri */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Hesap Bilgileri</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="font-semibold text-slate-500">Hesap Tipi</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.organizationId ? 'Kurumsal Hesap' : 'Bireysel Hesap'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Sistem Rolü</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.role === 'ADMIN' ? 'Yönetici (Admin)' : 'Kullanıcı (Standart)'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Kayıt Tarihi</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{formatDate(profile.createdAt)}</dd></div>
              <div><dt className="font-semibold text-slate-500">Son Giriş</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3 text-slate-500 italic">Veri yok (Desteklenmiyor)</dd></div>
            </dl>
          </section>

          {/* Mevcut Paket */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Mevcut Paket</h2>
            <div className="mt-5 space-y-4 text-sm">
              {profile.currentPlan ? (
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-slate-800">{profile.currentPlan.name}</span>
                    {profile.currentPlan.status === 'PENDING_PAYMENT' ? (
                      <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                        Ödeme Bekliyor
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold">
                        {profile.currentPlan.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Ödeme onaylandığında haklarınız aktif hale gelecektir.
                  </p>
                  <Link href={`/checkout?planId=${profile.currentPlan.id}`} className="mt-2 text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1">
                    Ödeme Sayfasına Git &rarr;
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 text-center">
                  <p className="text-slate-600 mb-3 font-medium">Henüz paket seçmediniz.</p>
                  <Link href="/plans" className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 transition">
                    Paketleri İncele
                  </Link>
                </div>
              )}
            </div>
          </section>

          {isCorporate && (
            <>
              {/* Kurumsal Bilgiler */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">Kurumsal Bilgiler</h2>
                <dl className="mt-5 space-y-4 text-sm">
                  <div><dt className="font-semibold text-slate-500">Firma adı</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.organizationName ?? 'Kurumsal bilgi yok'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Firma türü</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.organizationType ? organizationTypeLabels[profile.organization.organizationType] ?? profile.organization.organizationType : '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Organizasyon rolü</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.membershipRole ? organizationRoleLabels[profile.organization.membershipRole] ?? profile.organization.membershipRole : '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Üyelik durumu</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{profile.organization?.membershipStatus ? membershipStatusLabels[profile.organization.membershipStatus] ?? profile.organization.membershipStatus : '—'}</dd></div>
                </dl>
              </section>

              {/* Kurumsal Hesap Özeti */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">Kurumsal Hesap Özeti</h2>
                <dl className="mt-5 space-y-4 text-sm">
                  <div><dt className="font-semibold text-slate-500">Kurumsal hesap durumu</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.accountStatus ?? '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Kurum adı</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.organizationName ?? '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Sektör</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.organizationType ?? '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Kurumdaki rol</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.organizationRole ?? '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Başvuru durumu</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.applicationStatus ?? applicationViewState.badge}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Onay tarihi</dt><dd className="mt-1 rounded-lg bg-slate-50 p-3">{organizationSummary?.approvalDate ?? '—'}</dd></div>
                  
                  {applicationViewState.kind === 'rejected' && (
                    <div>
                      <dt className="font-semibold text-rose-600">Başvuru Red Nedeni</dt>
                      <dd className="mt-1 rounded-lg bg-rose-50 border border-rose-100 p-3 text-rose-800 font-medium animate-fade-in">
                        {applicationViewState.rejectionReason}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            </>
          )}

          {/* EİDS Doğrulaması */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold">EİDS Doğrulaması</h2>
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{eidsCard?.message}</p>
            {canStartEids && <button className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={false} onClick={() => void startEidsAuthorization()} type="button">EİDS ile Doğrula</button>}
            {eidsCard?.showAction && <button className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500" disabled={eidsCard.actionDisabled} type="button">EİDS ile Doğrula (Yakında)</button>}
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </form>}
      </div>
    </AppShell>
  );
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
