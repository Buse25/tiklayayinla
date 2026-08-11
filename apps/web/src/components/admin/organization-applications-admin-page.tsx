'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { AppNavigation } from '../navigation/app-navigation';
import {
  canApproveOrganizationApplication,
  canRejectOrganizationApplication,
  countOrganizationApplications,
  filterOrganizationApplications,
  getOrganizationApplicationLicenseRequirement,
  getOrganizationApplicationSectorLabel,
  getOrganizationApplicationStatusLabel,
  getOrganizationApplicationStatusTone,
  maskOrganizationVkn,
  type OrganizationApplicationAdminItem,
  type OrganizationApplicationAdminReviewResponse,
  type OrganizationApplicationTab,
  validateRejectionReason,
} from '../../lib/organization-applications-admin';

type CurrentUser = { role: string };

export function OrganizationApplicationsAdminPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const [applications, setApplications] = useState<OrganizationApplicationAdminItem[]>([]);
  const [selectedTab, setSelectedTab] = useState<OrganizationApplicationTab>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejectingItem, setRejectingItem] = useState<OrganizationApplicationAdminItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Selected Detail state
  const [selectedDetail, setSelectedDetail] = useState<OrganizationApplicationAdminItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit form states
  const [editingItem, setEditingItem] = useState<OrganizationApplicationAdminItem | null>(null);
  const [editForm, setEditForm] = useState<{
    organizationName: string;
    organizationType: 'REAL_ESTATE_AGENCY' | 'AUTO_DEALER' | 'OTHER';
    taxOffice: string | null;
    vkn: string | null;
    authorizedPersonName: string;
    companyPhone: string | null;
    businessEmail: string | null;
    address: string;
    licenseNumber: string | null;
    country: string;
    city: string;
    district: string;
  }>({
    organizationName: '',
    organizationType: 'REAL_ESTATE_AGENCY',
    taxOffice: null,
    vkn: null,
    authorizedPersonName: '',
    companyPhone: null,
    businessEmail: null,
    address: '',
    licenseNumber: null,
    country: 'Türkiye',
    city: '',
    district: '',
  });
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    setForbidden(false);
    try {
      const [profileResponse, applicationsResponse] = await Promise.all([
        authenticatedFetch('users/me'),
        authenticatedFetch('organizations/applications/admin'),
      ]);
      if (!profileResponse.ok) throw new Error(await readMessage(profileResponse, 'Profil bilgisi alınamadı.'));
      const profileData = await profileResponse.json() as CurrentUser;
      setProfile(profileData);
      if (profileData.role !== 'ADMIN') {
        setForbidden(true);
        setApplications([]);
        router.push('/dashboard');
        return;
      }
      if (!applicationsResponse.ok) throw new Error(await readMessage(applicationsResponse, 'Başvurular yüklenemedi.'));
      const items = await applicationsResponse.json() as OrganizationApplicationAdminItem[];
      setApplications(items);
      setSelectedId((current) => current ?? items[0]?.id ?? null);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Başvurular yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => countOrganizationApplications(applications), [applications]);
  const visibleApplications = useMemo(() => filterOrganizationApplications(applications, selectedTab), [applications, selectedTab]);
  const selectedApplication = useMemo(() => visibleApplications.find((item) => item.id === selectedId) ?? visibleApplications[0] ?? null, [selectedId, visibleApplications]);

  // Fetch details when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    let active = true;
    async function fetchDetail() {
      setLoadingDetail(true);
      try {
        const response = await authenticatedFetch(`organizations/applications/admin/${selectedId}`);
        if (!response.ok) throw new Error('Başvuru detayı alınamadı.');
        const data = await response.json() as OrganizationApplicationAdminItem;
        if (active) setSelectedDetail(data);
      } catch {
        if (active) {
          const listItem = applications.find(item => item.id === selectedId);
          setSelectedDetail(listItem ?? null);
        }
      } finally {
        if (active) setLoadingDetail(false);
      }
    }
    void fetchDetail();
    return () => { active = false; };
  }, [selectedId, applications]);

  const detailToShow = selectedDetail ?? selectedApplication;

  async function approveApplication(application: OrganizationApplicationAdminItem) {
    if (!canApproveOrganizationApplication(application.status) || savingAction) return;
    if (!window.confirm(`${application.organizationName} başvurusunu onaylamak istiyor musunuz?`)) return;
    setSavingAction(application.id);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch(`organizations/applications/${application.id}/approve`, { method: 'PATCH' });
      if (!response.ok) throw new Error(await readMessage(response, 'Başvuru onaylanamadı.'));
      const payload = await response.json() as OrganizationApplicationAdminReviewResponse;
      setNotice(payload.organization ? `${payload.organizationName} onaylandı. Oluşan kurum: ${payload.organization.name}` : `${payload.organizationName} onaylandı.`);
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Başvuru onaylanamadı.');
    } finally {
      setSavingAction(null);
    }
  }

  async function toggleApprovedStatus(application: OrganizationApplicationAdminItem) {
    if (!['APPROVED', 'SUSPENDED'].includes(application.status) || savingAction) return;
    if (!window.confirm(`${application.organizationName} kurumunun durumunu değiştirmek istediğinize emin misiniz?`)) return;
    setSavingAction(application.id); setError(''); setNotice('');
    try {
      const status = application.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED';
      const response = await authenticatedFetch(`organizations/applications/${application.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error(await readMessage(response, 'Başvuru durumu değiştirilemedi.'));
      setNotice(`${application.organizationName} durumu güncellendi.`); await load();
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Başvuru durumu değiştirilemedi.'); }
    finally { setSavingAction(null); }
  }

  function openRejectDialog(application: OrganizationApplicationAdminItem) {
    if (!canRejectOrganizationApplication(application.status)) return;
    setRejectingItem(application);
    setRejectionReason(application.rejectionReason ?? '');
    setRejectionError('');
  }

  async function rejectApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectingItem || savingAction) return;
    const validationMessage = validateRejectionReason(rejectionReason);
    if (validationMessage) {
      setRejectionError(validationMessage);
      return;
    }
    setSavingAction(rejectingItem.id);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch(`organizations/applications/${rejectingItem.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });
      if (!response.ok) throw new Error(await readMessage(response, 'Başvuru reddedilemedi.'));
      const payload = await response.json() as OrganizationApplicationAdminReviewResponse;
      setNotice(`${payload.organizationName} reddedildi.`);
      setRejectingItem(null);
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Başvuru reddedilemedi.');
    } finally {
      setSavingAction(null);
    }
  }

  function openEditDialog(application: OrganizationApplicationAdminItem) {
    setEditingItem(application);
    setEditForm({
      organizationName: application.organizationName,
      organizationType: (application.organizationType ?? 'REAL_ESTATE_AGENCY') as NonNullable<OrganizationApplicationAdminItem['organizationType']>,
      taxOffice: application.taxOffice ?? null,
      vkn: application.vkn ?? null,
      authorizedPersonName: application.authorizedPersonName,
      companyPhone: application.companyPhone ?? null,
      businessEmail: application.businessEmail ?? null,
      address: application.address,
      licenseNumber: application.licenseNumber ?? null,
      country: application.country ?? 'Türkiye',
      city: application.city,
      district: application.district,
    });
    setEditError('');
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem || savingAction) return;

    setSavingAction(editingItem.id);
    setEditError('');
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch(`organizations/applications/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: editForm.organizationName,
          organizationType: editForm.organizationType,
          taxOffice: editForm.taxOffice,
          vkn: editForm.vkn,
          authorizedPersonName: editForm.authorizedPersonName,
          companyPhone: editForm.companyPhone,
          businessEmail: editForm.businessEmail,
          address: editForm.address,
          licenseNumber: editForm.organizationType === 'AUTO_DEALER' ? editForm.licenseNumber : null,
          country: editForm.country,
          city: editForm.city,
          district: editForm.district,
        }),
      });

      if (!response.ok) throw new Error(await readMessage(response, 'Başvuru güncellenemedi.'));
      const updatedItem = await response.json() as OrganizationApplicationAdminItem;

      setApplications((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
      setSelectedDetail(updatedItem);
      setNotice(`${updatedItem.organizationName} başarıyla güncellendi.`);
      setEditingItem(null);
    } catch (exception) {
      setEditError(exception instanceof Error ? exception.message : 'Başvuru güncellenemedi.');
    } finally {
      setSavingAction(null);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><div className="h-10 w-72 animate-pulse rounded bg-slate-200" /><div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="h-[34rem] animate-pulse rounded-2xl bg-slate-200" /><div className="h-[34rem] animate-pulse rounded-2xl bg-slate-200" /></div></div></main>;
  }

  if (forbidden) {
    return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl"><header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-teal-700">YÖNETİM</p><h1 className="mt-1 text-3xl font-bold">Kurumsal Başvurular</h1></div><AppNavigation activeHref="/admin/organization-applications" role={profile?.role ?? null} /></header><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900"><h2 className="font-bold">Admin yetkisi gerekli</h2><p className="mt-2 text-sm">Bu ekran yalnızca admin kullanıcılar için görünür.</p><div className="mt-4 flex flex-wrap gap-3"><Link className="rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100" href="/dashboard">Dashboard</Link><Link className="rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100" href="/profile">Profile dön</Link></div></section></div></main>;
  }

  const tabs: Array<{ key: OrganizationApplicationTab; label: string; count: number }> = [
    { key: 'PENDING', label: 'Bekleyen', count: counts.PENDING },
    { key: 'APPROVED', label: 'Onaylanan', count: counts.APPROVED },
    { key: 'REJECTED', label: 'Reddedilen', count: counts.REJECTED },
    { key: 'ALL', label: 'Tümü', count: counts.ALL },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">YÖNETİM</p>
            <h1 className="mt-1 text-3xl font-bold">Kurumsal Başvurular</h1>
            <p className="mt-2 text-slate-600">Başvuruları inceleyin, onaylayın veya reddedin.</p>
          </div>
          <AppNavigation activeHref="/admin/organization-applications" role={profile?.role ?? null} />
        </header>

        {error && (
          <section className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold hover:bg-red-100" onClick={() => void load()} type="button">Tekrar dene</button>
          </section>
        )}
        {notice && (
          <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>
        )}

        <section className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              aria-pressed={selectedTab === tab.key}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selectedTab === tab.key ? 'border-teal-600 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'}`}
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              type="button"
            >
              {tab.label} <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-xs">{tab.count}</span>
            </button>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Firma adı</th>
                    <th className="px-4 py-3">Sektör</th>
                    <th className="px-4 py-3">Yetkili kişi</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Kurumsal e-posta</th>
                    <th className="px-4 py-3">Şehir / ilçe</th>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleApplications.map((application) => (
                    <tr
                      className={`cursor-pointer transition hover:bg-teal-50 ${selectedApplication?.id === application.id ? 'bg-teal-50' : ''}`}
                      key={application.id}
                      onClick={() => setSelectedId(application.id)}
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{application.organizationName}</p>
                        <p className="mt-1 text-xs text-slate-500">VKN: {maskOrganizationVkn(application.vkn)}</p>
                      </td>
                      <td className="px-4 py-4">{getOrganizationApplicationSectorLabel(application)}</td>
                      <td className="px-4 py-4">{application.authorizedPersonName}</td>
                      <td className="px-4 py-4">{application.companyPhone ?? '—'}</td>
                      <td className="px-4 py-4">{application.businessEmail ?? '—'}</td>
                      <td className="px-4 py-4">{application.city} / {application.district}</td>
                      <td className="px-4 py-4">{formatDate(application.createdAt)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass(getOrganizationApplicationStatusTone(application.status))}`}>
                          {getOrganizationApplicationStatusLabel(application.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {visibleApplications.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>Bu sekmede başvuru yok.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            {detailToShow ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Başvuru detayı</p>
                    <h2 className="mt-1 text-2xl font-bold">{detailToShow.organizationName}</h2>
                    <p className="mt-1 text-sm text-slate-600">{getOrganizationApplicationSectorLabel(detailToShow)}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(getOrganizationApplicationStatusTone(detailToShow.status))}`}>
                    {getOrganizationApplicationStatusLabel(detailToShow.status)}
                  </span>
                </div>

                {loadingDetail && (
                  <p className="mt-3 text-xs text-teal-600 animate-pulse font-semibold">Detaylar güncelleniyor...</p>
                )}

                <dl className="mt-5 space-y-4 text-sm">
                  <div>
                    <dt className="font-semibold text-slate-500">Firma bilgileri</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">{detailToShow.organizationName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Adres</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">{detailToShow.address}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Vergi dairesi</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">{detailToShow.taxOffice ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Maskeli VKN</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">{maskOrganizationVkn(detailToShow.vkn)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Yetkili kişi</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">{detailToShow.authorizedPersonName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">İletişim</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">{detailToShow.companyPhone ?? '—'}{detailToShow.businessEmail ? ` · ${detailToShow.businessEmail}` : ''}</dd>
                  </div>
                  {getOrganizationApplicationLicenseRequirement(detailToShow.organizationType).visible && (
                    <div>
                      <dt className="font-semibold text-slate-500">{getOrganizationApplicationLicenseRequirement(detailToShow.organizationType).label}</dt>
                      <dd className="mt-1 rounded-xl bg-slate-50 p-3">{detailToShow.licenseNumber ?? '—'}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-semibold text-slate-500">İnceleme geçmişi</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">
                      <ul className="space-y-2">
                        {reviewHistory(detailToShow).map((item) => (
                          <li key={item.label}>
                            <strong className="block text-slate-900">{item.label}</strong>
                            <span className="text-slate-600">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Red nedeni</dt>
                    <dd className="mt-1 rounded-xl bg-slate-50 p-3">{detailToShow.rejectionReason?.trim() || '—'}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-3">
                  {detailToShow.status === 'PENDING' ? (
                    <>
                      <button
                        className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 transition disabled:opacity-50"
                        disabled={!!savingAction}
                        onClick={() => void approveApplication(detailToShow)}
                        type="button"
                      >
                        {savingAction === detailToShow.id ? 'Onaylanıyor...' : 'Onayla'}
                      </button>
                      <button
                        className="rounded-xl border border-rose-300 bg-white px-4 py-3 font-semibold text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                        disabled={!!savingAction}
                        onClick={() => openRejectDialog(detailToShow)}
                        type="button"
                      >
                        Reddet
                      </button>
                      <button
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                        disabled={!!savingAction}
                        onClick={() => openEditDialog(detailToShow)}
                        type="button"
                      >
                        Düzenle
                      </button>
                    </>
                  ) : ['APPROVED', 'SUSPENDED'].includes(detailToShow.status) ? (
                    <>
                    <button className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 transition disabled:opacity-50" disabled={!!savingAction} onClick={() => void toggleApprovedStatus(detailToShow)} type="button">
                      {detailToShow.status === 'APPROVED' ? 'Askıya al' : 'Tekrar onayla'}
                    </button>
                    <button className="rounded-xl border border-rose-300 bg-white px-4 py-3 font-semibold text-rose-700 hover:bg-rose-50 transition disabled:opacity-50" disabled={!!savingAction} onClick={() => openRejectDialog(detailToShow)} type="button">Reddet</button>
                    </>
                  ) : (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 w-full text-center">Bu başvuru zaten işlenmiş.</p>
                  )}
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">Seçili başvuru yok.</section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Güvenli bağlantılar</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100" href="/dashboard">Dashboard</Link>
                <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100" href="/profile">Profil</Link>
                <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100" href="/activity">Aktivite</Link>
              </div>
            </section>
          </aside>
        </div>

        {rejectingItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
            <form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onSubmit={rejectApplication}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-rose-700">Başvuru reddi</p>
                  <h3 className="mt-1 text-xl font-bold">{rejectingItem.organizationName}</h3>
                </div>
                <button className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold hover:bg-slate-50" onClick={() => setRejectingItem(null)} type="button">Kapat</button>
              </div>
              <label className="mt-4 block text-sm font-semibold">Red nedeni
                <textarea className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" minLength={10} onChange={(event) => setRejectionReason(event.target.value)} required value={rejectionReason} />
              </label>
              {rejectionError && (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{rejectionError}</p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setRejectingItem(null)} type="button">Vazgeç</button>
                <button className="rounded-xl bg-rose-700 px-4 py-3 font-semibold text-white disabled:opacity-50 hover:bg-rose-800" disabled={!!savingAction} type="submit">
                  {savingAction === rejectingItem.id ? 'Reddediliyor...' : 'Reddet'}
                </button>
              </div>
            </form>
          </div>
        )}

        {editingItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 overflow-y-auto">
            <form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-8" onSubmit={saveEdit}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-teal-700">Başvuru Düzenle</p>
                  <h3 className="mt-1 text-xl font-bold">{editingItem.organizationName}</h3>
                </div>
                <button className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold hover:bg-slate-50" onClick={() => setEditingItem(null)} type="button">Kapat</button>
              </div>

              <div className="mt-4 space-y-4 text-sm text-left">
                <div>
                  <label className="block font-semibold mb-1">Şirket Unvanı</label>
                  <input
                    className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600"
                    required
                    type="text"
                    value={editForm.organizationName}
                    onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Sektör Tipi</label>
                    <select
                      className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600 bg-white"
                      value={editForm.organizationType}
                      onChange={(e) => setEditForm({ ...editForm, organizationType: e.target.value as NonNullable<OrganizationApplicationAdminItem['organizationType']> })}
                    >
                      <option value="REAL_ESTATE_AGENCY">Emlak Ofisi</option>
                      <option value="AUTO_DEALER">Oto Galeri</option>
                      <option value="OTHER">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Vergi Dairesi</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600"
                      type="text"
                      value={editForm.taxOffice ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, taxOffice: e.target.value || null })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Vergi No (VKN)</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600"
                      type="text"
                      value={editForm.vkn ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, vkn: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Yetkili Kişi Adı</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600"
                      required
                      type="text"
                      value={editForm.authorizedPersonName}
                      onChange={(e) => setEditForm({ ...editForm, authorizedPersonName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">İş E-postası</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600"
                      type="email"
                      value={editForm.businessEmail ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, businessEmail: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Yetki Belge No</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600"
                      type="text"
                      value={editForm.licenseNumber ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, licenseNumber: e.target.value || null })}
                      placeholder={editForm.organizationType !== 'AUTO_DEALER' ? 'Gerekli değil' : 'Örn: EIDS-YETKI-2026-001'}
                      disabled={editForm.organizationType !== 'AUTO_DEALER'}
                      required={editForm.organizationType === 'AUTO_DEALER'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Adres</label>
                  <textarea
                    className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-600 min-h-20"
                    required
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
              </div>

              {editError && (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 text-left">{editError}</p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setEditingItem(null)} type="button">Vazgeç</button>
                <button className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50" disabled={!!savingAction} type="submit">
                  {savingAction === editingItem.id ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

function statusBadgeClass(tone: string) {
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function reviewHistory(item: OrganizationApplicationAdminItem) {
  const history = [
    { label: 'Başvuru oluşturuldu', value: formatDate(item.createdAt) },
  ];
  if (item.reviewedAt) {
    history.push({ label: item.status === 'APPROVED' ? 'Başvuru onaylandı' : 'Başvuru reddedildi', value: formatDate(item.reviewedAt) });
  }
  return history;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function readMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message;
    return typeof message === 'string' && message.trim().length ? message : fallback;
  } catch {
    return fallback;
  }
}
