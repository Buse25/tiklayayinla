'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';

type ListingMedia = { id: string; url: string; sortOrder: number; isCover?: boolean };
type ListingStatus = 'DRAFT' | 'PUBLISHING' | 'ACTIVE' | 'ARCHIVED';
type Listing = {
  id: string;
  listingNo: string;
  title: string;
  city: string;
  district: string;
  price: number;
  currency: string;
  status: ListingStatus;
  createdAt: string;
  media: ListingMedia[];
};
type ListingsResponse = { data: Listing[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
type PortalAccount = { id: string; connectionStatus: string; lastCheckedAt?: string | null; portal: { name: string; code: string } };
type BulkResult = { listingId: string; success: boolean; status?: ListingStatus; jobsCreated?: number; errorCode?: string; message?: string };
type BulkResponse = { requested: number; successful: number; failed: number; jobsCreated: number; results: BulkResult[] };

const statusLabels: Record<ListingStatus, string> = { DRAFT: 'Taslak', PUBLISHING: 'Yayınlanıyor', ACTIVE: 'Aktif', ARCHIVED: 'Arşivlendi' };
const statusStyles: Record<ListingStatus, string> = { DRAFT: 'bg-amber-50 text-amber-800 ring-amber-200', PUBLISHING: 'bg-blue-50 text-blue-800 ring-blue-200', ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-200', ARCHIVED: 'bg-slate-100 text-slate-700 ring-slate-200' };
const filterOptions: Array<{ label: string; value: 'ALL' | ListingStatus }> = [{ label: 'Tümü', value: 'ALL' }, { label: 'Taslak', value: 'DRAFT' }, { label: 'Yayınlanıyor', value: 'PUBLISHING' }, { label: 'Aktif', value: 'ACTIVE' }, { label: 'Arşiv', value: 'ARCHIVED' }];
const knownErrors: Record<string, string> = {
  LISTING_NOT_FOUND: 'İlan bulunamadı veya bu ilana erişim yetkiniz yok.',
  INVALID_STATUS_TRANSITION: 'İlanın mevcut durumundan bu duruma geçiş yapılamaz.',
  NO_ELIGIBLE_PUBLICATIONS: 'Yeniden gönderilmeye uygun portal yayını bulunmuyor.',
};

function coverImage(media: ListingMedia[]): ListingMedia | undefined {
  return media.find((item) => item.isCover) ?? [...media].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value?: string | null): string {
  return value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function safeError(response: Response) {
  if (response.status === 422) {
    try {
      const data = await response.json();
      const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
      if (typeof message === 'string') return message;
    } catch {}
    return 'Toplu işlem isteğini kontrol edin.';
  }
  if (response.status === 500 || response.status === 502) return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
  if (response.status === 404) return 'İlan veya portal hesabı bulunamadı.';
  if (response.status === 409) return 'Seçilen ilanların mevcut durumu bu işlem için uygun değil.';
  return 'İşlem tamamlanamadı.';
}

function resultMessage(result: BulkResponse) {
  return `${result.requested} ilandan ${result.successful}’ü başarıyla işlendi, ${result.failed}’si başarısız oldu.`;
}

export function ListingsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ListingStatus>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<ListingsResponse | null>(null);
  const [portalAccounts, setPortalAccounts] = useState<PortalAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPortalIds, setSelectedPortalIds] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const visibleListings = result?.data ?? [];
  const visibleIds = useMemo(() => visibleListings.map((listing) => listing.id), [visibleListings]);
  const connectedAccounts = useMemo(() => portalAccounts.filter((account) => account.connectionStatus === 'CONNECTED'), [portalAccounts]);
  const listingLookup = useMemo(() => new Map(visibleListings.map((listing) => [listing.id, listing])), [visibleListings]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  useEffect(() => {
    let active = true;

    async function loadListings() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '12' });
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        const [listingsResponse, accountsResponse] = await Promise.all([
          authenticatedFetch(`listings?${params.toString()}`),
          authenticatedFetch('portal-accounts'),
        ]);
        if (!listingsResponse.ok) {
          if (listingsResponse.status !== 401) setError('İlanlar yüklenemedi. Lütfen tekrar deneyin.');
          return;
        }
        const payload = await listingsResponse.json() as ListingsResponse;
        if (active) {
          setResult(payload);
          setSelectedIds((current) => current.filter((id) => payload.data.some((listing) => listing.id === id)));
        }
        if (accountsResponse.ok && active) setPortalAccounts(await accountsResponse.json());
      } catch {
        if (active) setError('İlanlar yüklenirken bağlantı sorunu oluştu.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadListings();
    return () => { active = false; };
  }, [page, reloadKey, statusFilter]);

  function changeFilter(value: 'ALL' | ListingStatus) {
    setStatusFilter(value);
    setPage(1);
    setSelectedIds([]);
    setSelectedPortalIds([]);
  }

  function toggleListing(listingId: string) {
    setBulkError(null);
    setSelectedIds((current) => current.includes(listingId) ? current.filter((id) => id !== listingId) : [...current, listingId]);
  }

  function selectAllVisible() {
    setSelectedIds(visibleIds);
  }

  function clearSelection() {
    setSelectedIds([]);
    setSelectedPortalIds([]);
  }

  function togglePortal(accountId: string) {
    setSelectedPortalIds((current) => current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId]);
  }

  async function runBulkStatus(status: 'ARCHIVED' | 'DRAFT') {
    if (!selectedIds.length || busyAction) return;
    const confirmText = status === 'ARCHIVED' ? 'Seçilen ilanlar arşivlenecek.' : 'Seçilen ilanlar taslağa geri alınacak.';
    if (!window.confirm(confirmText)) return;
    await runBulk('status', 'listings/bulk/status', { listingIds: selectedIds, status });
  }

  async function runBulkPublish() {
    if (!selectedIds.length || busyAction) return;
    if (!connectedAccounts.length) { setBulkError('Yayınlama için bağlantısı doğrulanmış bir portal hesabı bulunmuyor.'); return; }
    if (!selectedPortalIds.length) { setBulkError('Toplu yayınlama için en az bir portal hesabı seçin.'); return; }
    await runBulk('publish', 'listings/bulk/publish', { listingIds: selectedIds, portalAccountIds: selectedPortalIds });
  }

  async function runBulkRepublish() {
    if (!selectedIds.length || busyAction) return;
    await runBulk('republish', 'listings/bulk/republish', { listingIds: selectedIds });
  }

  async function runBulk(action: string, path: string, body: Record<string, unknown>) {
    setBusyAction(action);
    setBulkError(null);
    setBulkResult(null);
    try {
      const response = await authenticatedFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await safeError(response));
      const payload = await response.json() as BulkResponse;
      setBulkResult(payload);
      clearSelection();
      setReloadKey((current) => current + 1);
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Toplu işlem tamamlanamadı.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">PORTFÖY</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">İlanlarım</h1>
            {!isLoading && result && <p className="mt-2 text-sm text-slate-600">Toplam {result.pagination.total} ilan</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/dashboard">Dashboard</Link>
            <Link className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/portal-accounts">Portal Hesapları</Link>
            <Link className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" href="/listings/import">Toplu İlan İçe Aktar</Link>
            <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={isLoggingOut} onClick={() => void logout()} type="button">{isLoggingOut ? 'Çıkış yapılıyor...' : 'Çıkış yap'}</button>
            <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800" href="/listings/new">
              <span className="material-symbols-rounded text-[20px]">add_home</span>
              Yeni İlan
            </Link>
          </div>
        </header>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">{filterOptions.map((option) => <button className={`rounded-full px-4 py-2 text-sm font-semibold ${statusFilter === option.value ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} key={option.value} onClick={() => changeFilter(option.value)} type="button">{option.label}</button>)}</div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button className="font-semibold text-teal-700 disabled:text-slate-400" disabled={visibleIds.length === 0 || allVisibleSelected} onClick={selectAllVisible} type="button">Tümünü Seç</button>
              <button className="font-semibold text-teal-700 disabled:text-slate-400" disabled={selectedIds.length === 0} onClick={clearSelection} type="button">Seçimi Temizle</button>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{selectedIds.length} ilan seçildi</span>
            </div>
          </div>
        </section>

        {selectedIds.length > 0 && <section className="mb-5 rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="font-bold">Toplu işlem</h2>
              <p className="mt-1 text-sm text-slate-600">{selectedIds.length} ilan seçildi. Aynı ilan bir kez gönderilir.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={!!busyAction} onClick={() => void runBulkStatus('ARCHIVED')} type="button">{busyAction === 'status' ? 'İşleniyor...' : 'Arşivle'}</button>
                <button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={!!busyAction} onClick={() => void runBulkStatus('DRAFT')} type="button">{busyAction === 'status' ? 'İşleniyor...' : 'Taslağa Geri Al'}</button>
                <button className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!!busyAction || selectedPortalIds.length === 0 || connectedAccounts.length === 0} onClick={() => void runBulkPublish()} type="button">{busyAction === 'publish' ? 'Yayınlanıyor...' : 'Portallara Yayınla'}</button>
                <button className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!!busyAction} onClick={() => void runBulkRepublish()} type="button">{busyAction === 'republish' ? 'Yeniden gönderiliyor...' : 'Yeniden Yayınla'}</button>
                <button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={!!busyAction} onClick={clearSelection} type="button">Seçimi Temizle</button>
              </div>
            </div>
            <div className="min-w-0 xl:w-[360px]">
              <h3 className="text-sm font-bold">Yayınlanacak portallar</h3>
              {connectedAccounts.length ? <div className="mt-2 max-h-40 space-y-2 overflow-auto rounded-xl bg-slate-50 p-2">{connectedAccounts.map((account) => <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-2 text-sm" key={account.id}><input checked={selectedPortalIds.includes(account.id)} className="mt-1" disabled={!!busyAction} onChange={() => togglePortal(account.id)} type="checkbox" /><span><span className="block font-semibold">{account.portal.name}</span><span className="block text-xs text-slate-500">{account.portal.code} · Son test: {formatDateTime(account.lastCheckedAt)}</span></span></label>)}</div> : <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><p>Yayınlama için bağlantısı doğrulanmış bir portal hesabı bulunmuyor.</p><Link className="mt-2 inline-block font-semibold underline" href="/portal-accounts">Portal Hesaplarına Git</Link></div>}
            </div>
          </div>
          {bulkError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{bulkError}</p>}
        </section>}

        {bulkResult && <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Toplu işlem sonucu</h2>
          <p className="mt-2 text-sm text-slate-700">{resultMessage(bulkResult)}</p>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            <Metric label="İstenen" value={bulkResult.requested} />
            <Metric label="Başarılı" value={bulkResult.successful} />
            <Metric label="Başarısız" value={bulkResult.failed} />
            <Metric label="Oluşan job" value={bulkResult.jobsCreated} />
          </div>
          {bulkResult.results.length > 0 && <ul className="mt-4 divide-y divide-slate-100">{bulkResult.results.map((item) => {
            const listing = listingLookup.get(item.listingId);
            const errorText = item.errorCode ? knownErrors[item.errorCode] ?? item.message ?? 'İşlem tamamlanamadı.' : '';
            return <li className="py-3 text-sm" key={item.listingId}><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold">{listing?.listingNo ?? item.listingId}</span><span className={item.success ? 'text-emerald-700' : 'text-red-700'}>{item.success ? `Başarılı${item.jobsCreated ? ` · ${item.jobsCreated} job` : item.status ? ` · ${statusLabels[item.status] ?? item.status}` : ''}` : `${item.errorCode ?? 'HATA'} · ${errorText}`}</span></div></li>;
          })}</ul>}
        </section>}

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="İlanlar yükleniyor">{Array.from({ length: 6 }).map((_, index) => <div className="h-64 animate-pulse rounded-2xl bg-slate-200" key={index} />)}</div>}

        {!isLoading && error && <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800" role="alert"><h2 className="font-semibold">İlanlar alınamadı</h2><p className="mt-1 text-sm">{error}</p><button className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold hover:bg-red-100" onClick={() => setReloadKey((current) => current + 1)} type="button">Tekrar dene</button></section>}

        {!isLoading && !error && result?.data.length === 0 && <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="material-symbols-rounded text-5xl text-slate-400">home_work</span><h2 className="mt-4 text-xl font-bold">Henüz ilan bulunmuyor</h2><p className="mt-2 text-sm text-slate-600">Seçili filtrede portföy kaydı yok.</p><Link className="mt-6 inline-flex rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800" href="/listings/new">Yeni İlan Oluştur</Link></section>}

        {!isLoading && !error && result && result.data.length > 0 && <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.data.map((listing) => {
              const cover = coverImage(listing.media);
              const checked = selectedIds.includes(listing.id);
              return <article className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${checked ? 'border-teal-500 ring-2 ring-teal-100' : 'border-slate-200'}`} key={listing.id}>
                <div className="relative flex h-44 items-center justify-center bg-slate-100">
                  <label className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold shadow-sm"><input checked={checked} onChange={() => toggleListing(listing.id)} type="checkbox" />Seç</label>
                  {cover ? <img alt="" className="h-full w-full object-cover" src={cover.url} /> : <span className="material-symbols-rounded text-5xl text-slate-400">image</span>}
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyles[listing.status]}`}>{statusLabels[listing.status]}</span>
                </div>
                <div className="p-5"><p className="text-xs font-semibold text-slate-500">{listing.listingNo}</p><Link className="mt-1 block truncate text-lg font-bold hover:text-teal-700" href={`/listings/${listing.id}`}>{listing.title}</Link><p className="mt-2 text-sm text-slate-600">{listing.district}, {listing.city}</p><div className="mt-5 flex items-end justify-between gap-3"><strong className="text-base">{formatPrice(listing.price, listing.currency)}</strong><time className="text-xs text-slate-500" dateTime={listing.createdAt}>{formatDate(listing.createdAt)}</time></div></div>
              </article>;
            })}
          </section>

          {result.pagination.totalPages > 1 && <nav aria-label="İlan sayfaları" className="mt-8 flex items-center justify-center gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" disabled={result.pagination.page === 1 || !!busyAction} onClick={() => setPage((current) => current - 1)} type="button">Önceki</button><span className="text-sm text-slate-600">Sayfa {result.pagination.page} / {result.pagination.totalPages}</span><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" disabled={result.pagination.page === result.pagination.totalPages || !!busyAction} onClick={() => setPage((current) => current + 1)} type="button">Sonraki</button></nav>}
        </>}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><strong className="mt-1 block text-lg">{value}</strong></div>;
}
