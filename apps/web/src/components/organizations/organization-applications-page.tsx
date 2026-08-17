'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { sectorLabel, type OrganizationType } from '../../lib/sector';
import { getLicenseNumberRequirement, getOrganizationApplicationStatusBadge, getOrganizationApplicationViewState, isCorporateApplicationBlockedByEids, normalizeApplicationLicenseNumber, type OrganizationApplicationItem } from '../../lib/organization-applications';
import { AppShell } from '../layout/app-shell';

type Application = OrganizationApplicationItem;

type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  phoneVerified: boolean;
  eids: {
    configured: boolean;
    verified: boolean;
    status: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';
    verifiedAt: string | null;
  };
  organization?: {
    organizationId: string | null;
    organizationName: string | null;
    organizationType: string | null;
    membershipRole: string | null;
    membershipStatus: string | null;
  } | null;
};

export function OrganizationApplicationsPage() {

  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    organizationName: '',
    organizationType: 'REAL_ESTATE_AGENCY' as OrganizationType,
    country: 'Türkiye',
    city: '',
    district: '',
    taxOffice: '',
    vkn: '',
    authorizedPersonName: '',
    companyPhone: '',
    businessEmail: '',
    address: '',
    licenseNumber: '',
  });

  const viewState = useMemo(() => {
    if (profile?.organization?.membershipStatus === 'ACTIVE') {
      return { kind: 'approved', badge: 'Onaylandı', message: 'Kurumsal hesabınız onaylandı.' } as const;
    }
    return getOrganizationApplicationViewState(applications);
  }, [applications, profile]);

  const licenseRequirement = useMemo(() => getLicenseNumberRequirement(form.organizationType), [form.organizationType]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [applicationsResponse, profileResponse] = await Promise.all([
        authenticatedFetch('organizations/applications'),
        authenticatedFetch('users/me'),
      ]);
      if (!applicationsResponse.ok || !profileResponse.ok) throw new Error('Veriler yüklenemedi.');
      setApplications(await applicationsResponse.json());
      setProfile(await profileResponse.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (viewState.kind === 'none') setShowForm(true);
    if (viewState.kind === 'pending' || viewState.kind === 'approved') setShowForm(false);
    if (viewState.kind === 'rejected' && showForm) return;
    if (viewState.kind === 'rejected' && !showForm) setShowForm(false);
  }, [showForm, viewState.kind]);

  useEffect(() => {
    if (form.organizationType !== 'AUTO_DEALER' && form.licenseNumber) {
      setForm((current) => ({ ...current, licenseNumber: '' }));
    }
  }, [form.organizationType, form.licenseNumber]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profile?.eids.configured && !profile.eids.verified) {
      setError('Kurumsal başvuru yapabilmek için önce EİDS kimlik doğrulamanızı tamamlamanız gerekiyor.');
      return;
    }
    if (form.organizationType === 'AUTO_DEALER' && !form.licenseNumber.trim()) {
      setError('Motorlu Kara Taşıtı Ticareti Yetki Belge No zorunludur.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch('organizations/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: form.organizationName.trim(),
          organizationType: form.organizationType,
          country: form.country.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
          taxOffice: form.taxOffice.trim() || null,
          vkn: form.vkn.trim() || null,
          authorizedPersonName: form.authorizedPersonName.trim(),
          companyPhone: form.companyPhone.trim() || null,
          businessEmail: form.businessEmail.trim() || null,
          address: form.address.trim(),
          licenseNumber: normalizeApplicationLicenseNumber(form.organizationType, form.licenseNumber),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = typeof payload?.message === 'string' ? payload.message : 'Başvuru oluşturulamadı.';
        throw new Error(message);
      }
      setNotice('Başvuru oluşturuldu.');
      setForm((current) => ({ ...current, taxOffice: '', vkn: '', authorizedPersonName: '', companyPhone: '', businessEmail: '', licenseNumber: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Başvuru oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  const canOpenForm = viewState.kind === 'none' || viewState.kind === 'rejected';
  const eidsRequired = isCorporateApplicationBlockedByEids(profile?.eids);

  return (
    <AppShell>
      <div className="p-md max-w-[1600px] mx-auto text-slate-900">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">KURUMSAL HESAP</p>
            <h1 className="mt-1 text-3xl font-bold">Kurumsal Başvuru</h1>
            <p className="mt-2 text-sm text-slate-600">Kurumsal başvurunuzu oluşturun, onay durumunu takip edin.</p>
          </div>
        </header>

      {error && <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      {viewState.kind === 'pending' && <StatusPanel tone="amber" title="Kurumsal başvurunuz incelemede." description={viewState.message} />}
      {viewState.kind === 'approved' && <StatusPanel tone="emerald" title="Kurumsal hesabınız onaylandı." description={viewState.message} />}
      {viewState.kind === 'rejected' && <StatusPanel tone="rose" title="Kurumsal başvurunuz reddedildi." description={viewState.rejectionReason} />}

      {viewState.kind === 'rejected' && !showForm && !eidsRequired && <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p>{viewState.rejectionReason}</p>
        <button className="mt-3 rounded-xl bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800" onClick={() => setShowForm(true)} type="button">Yeniden Başvur</button>
      </section>}

      {canOpenForm && eidsRequired && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Kurumsal başvuru yapabilmek için önce EİDS kimlik doğrulamanızı tamamlamanız gerekiyor.</p>
        <a className="mt-3 inline-flex rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800" href="/profile">Profilde EİDS doğrulamasına git</a>
      </section>}

      {canOpenForm && !eidsRequired && showForm && <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <Field label="Firma unvanı"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))} value={form.organizationName} /></Field>
          <Field label="Sektör"><select className="rounded-lg border bg-white p-3" onChange={(event) => setForm((current) => ({ ...current, organizationType: event.target.value as OrganizationType }))} value={form.organizationType}><option value="REAL_ESTATE_AGENCY">Emlak Ofisi</option><option value="AUTO_DEALER">Galeri / Otomotiv</option><option value="OTHER">Diğer</option></select></Field>
          <Field label="Ülke"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} value={form.country} /></Field>
          <Field label="Şehir"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} value={form.city} /></Field>
          <Field label="İlçe"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} value={form.district} /></Field>
          <Field label="Vergi dairesi"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, taxOffice: event.target.value }))} value={form.taxOffice} /></Field>
          <Field label="VKN"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, vkn: event.target.value }))} value={form.vkn} /></Field>
          <Field label="Yetkili kişi"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, authorizedPersonName: event.target.value }))} value={form.authorizedPersonName} /></Field>
          <Field label="Firma telefonu"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, companyPhone: event.target.value }))} value={form.companyPhone} /></Field>
          <Field label="Kurumsal e-posta"><input className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, businessEmail: event.target.value }))} value={form.businessEmail} /></Field>
          <Field label="Adres" full><textarea className="min-h-28 rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} value={form.address} /></Field>
          {licenseRequirement.visible && <Field label={licenseRequirement.label} required={licenseRequirement.required}><input aria-required={licenseRequirement.required} className="rounded-lg border p-3" onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))} value={form.licenseNumber} /></Field>}
          <div className="md:col-span-2 flex justify-end">
            <button className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Gönderiliyor...' : 'Başvuru Oluştur'}</button>
          </div>
        </form>
      </section>}

      {!showForm && viewState.kind === 'rejected' && !eidsRequired && <button className="mt-4 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setShowForm(true)} type="button">Yeniden Başvur</button>}

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Başvurular</h2>
        {loading ? <p className="mt-4 text-sm text-slate-600">Yükleniyor...</p> : applications.length === 0 ? <p className="mt-4 text-sm text-slate-600">Henüz başvuru yok.</p> : <div className="mt-4 space-y-3">{applications.map((item) => <article className="rounded-xl bg-slate-50 p-4 text-sm" key={item.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{item.organizationName}</p><span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{getOrganizationApplicationStatusBadge(item.status)}</span></div><p className="mt-2 text-slate-600">{sectorLabel(item.organizationType)} · {item.city}, {item.district}</p>{item.rejectionReason && <p className="mt-2 text-red-700">{item.rejectionReason}</p>}</article>)}</div>}
      </section>
      </div>
    </AppShell>
  );
}

function StatusPanel({ tone, title, description }: { tone: 'amber' | 'emerald' | 'rose'; title: string; description: string }) {
  const styles = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-rose-200 bg-rose-50 text-rose-900';
  return <section className={`rounded-2xl border p-4 text-sm ${styles}`}><p className="font-semibold">{title}</p><p className="mt-1">{description}</p></section>;
}

function Field({ label, children, full = false, required = false }: { label: string; children: ReactNode; full?: boolean; required?: boolean }) {
  return <label className={`grid gap-2 text-sm font-semibold ${full ? 'md:col-span-2' : ''}`}>{label}{required && <span className="text-red-600">*</span>}{children}</label>;
}
