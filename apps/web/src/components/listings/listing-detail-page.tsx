'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { translateAuditAction } from '../../lib/audit-logs';
import {
  buildListingDetailItems,
  formatListingActivityChanges,
  getListingStatusLabel,
  getListingTypeLabel,
  getPropertyTypeLabel,
  getPublicationLinkState,
  getPublicationStatusLabel,
} from '../../lib/listing-display-labels';

type Feature = { code: string; label: string };

type Listing = {
  id: string;
  listingNo: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  listingType: string;
  propertyType: string;
  status: string;
  city: string;
  district: string;
  neighborhood?: string | null;
  address: string;
  residentialDetails?: Record<string, unknown> | null;
  media: Array<{ id: string; url: string; isCover?: boolean; originalName?: string | null }>;
  features: Record<string, Feature[]>;
};

type Publication = {
  id: string;
  portalName: string;
  portalAccountId?: string | null;
  accountName?: string | null;
  externalListingId?: string | null;
  status: string;
  lastError?: string | null;
  publishedAt?: string | null;
  lastAttemptAt?: string | null;
  updatedAt?: string | null;
  externalUrl?: string | null;
};

type PortalAccount = {
  id: string;
  connectionStatus: string;
  lastCheckedAt?: string | null;
  lastError?: string | null;
  portal: { name: string; code: string };
};

type AuditLog = {
  id: string;
  action: string;
  createdAt: string;
  changes?: Record<string, unknown> | null;
  actor?: { firstName: string; lastName: string } | null;
};

type QueueResponse = { queuedJobCount?: number; publications?: Array<{ id: string }> };

const featureGroups: Array<[string, string]> = [
  ['facades', 'Cephe'],
  ['interiorFeatures', 'İç Özellikler'],
  ['exteriorFeatures', 'Dış Özellikler'],
  ['nearbyPlaces', 'Yakın Yerler'],
  ['transportation', 'Ulaşım'],
  ['views', 'Manzara'],
  ['accessibilityFeatures', 'Erişilebilirlik'],
];

const connectionStatusLabels: Record<string, string> = {
  CONNECTED: 'Bağlandı',
  DISCONNECTED: 'Bağlantı kesildi',
  FAILED: 'Başarısız',
  NOT_TESTED: 'Test edilmedi',
};

const republishableStatuses = new Set(['UPDATE_REQUIRED', 'FAILED']);

const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

function messageFor(status: number): string {
  if (status === 404) return 'İlan veya portal hesabı bulunamadı.';
  if (status === 409) return 'Bu işlem mevcut durumda yapılamaz. İlan arşivde, yayın sürecinde veya uygun yayın kaydı yok olabilir.';
  if (status === 422) return 'Seçimleri kontrol edin. Portal hesabı, görsel veya publication seçimi geçersiz olabilir.';
  if (status === 500 || status === 502) return 'Yayınlama işlemi tamamlanamadı. Lütfen tekrar deneyin.';
  return 'İşlem tamamlanamadı.';
}

async function safeMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    return typeof message === 'string' && message.length < 300 ? message : messageFor(response.status);
  } catch {
    return messageFor(response.status);
  }
}

function jobCount(data: QueueResponse, fallback: number): number {
  return data.queuedJobCount ?? data.publications?.length ?? fallback;
}

export function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [listing, setListing] = useState<Listing | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [portalAccounts, setPortalAccounts] = useState<PortalAccount[]>([]);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [selectedPortalIds, setSelectedPortalIds] = useState<string[]>([]);
  const [selectedPublicationIds, setSelectedPublicationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const connectedAccounts = useMemo(
    () => portalAccounts.filter((account) => account.connectionStatus === 'CONNECTED'),
    [portalAccounts],
  );
  const republishablePublications = useMemo(
    () => publications.filter((item) => republishableStatuses.has(item.status)),
    [publications],
  );
  const shouldPoll = Boolean(listing?.status === 'PUBLISHING' || publications.some((item) => item.status === 'QUEUED' || item.status === 'PROCESSING'));
  const hasMedia = Boolean(listing?.media.length);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const [detail, publicationResult, auditResult, accountResult] = await Promise.all([
        authenticatedFetch(`listings/${id}`),
        authenticatedFetch(`listings/${id}/publications`),
        authenticatedFetch(`audit-logs/entity/LISTING/${id}`),
        authenticatedFetch('portal-accounts'),
      ]);
      if (!detail.ok) {
        setError(detail.status === 404 ? 'İlan bulunamadı veya erişim izniniz yok.' : 'İlan bilgileri alınamadı.');
        return;
      }
      setListing(await detail.json());
      if (publicationResult.ok) setPublications(await publicationResult.json());
      if (auditResult.ok) setHistory((await auditResult.json()).data ?? []);
      if (accountResult.ok) setPortalAccounts(await accountResult.json());
    } catch {
      setError('İlan bilgileri alınamadı.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!shouldPoll || pollTimedOut) return;
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      if (Date.now() - startedAt >= 120_000) {
        window.clearInterval(intervalId);
        setPollTimedOut(true);
        return;
      }
      void load(true);
    }, 3_000);
    return () => window.clearInterval(intervalId);
  }, [load, pollTimedOut, shouldPoll]);

  useEffect(() => {
    if (!shouldPoll) setPollTimedOut(false);
  }, [shouldPoll]);

  async function changeStatus(status: 'ARCHIVED' | 'DRAFT') {
    if (!listing || action) return;
    const text = status === 'ARCHIVED' ? 'Bu ilan arşivlenecek. Devam etmek istiyor musunuz?' : 'İlan tekrar taslağa alınacak. Devam etmek istiyor musunuz?';
    if (!window.confirm(text)) return;
    setAction(status);
    setError(null);
    try {
      const response = await authenticatedFetch(`listings/${listing.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await safeMessage(response));
      await load(true);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'İşlem tamamlanamadı.');
    } finally {
      setAction(null);
    }
  }

  async function remove() {
    if (!listing || action || !window.confirm('Bu ilan kalıcı olarak silinecek. Bu işlem geri alınamaz.')) return;
    setAction('delete');
    setError(null);
    try {
      const response = await authenticatedFetch(`listings/${listing.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await safeMessage(response));
      router.push('/listings');
      router.refresh();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'İlan silinemedi.');
    } finally {
      setAction(null);
    }
  }

  async function publish() {
    if (!listing || action) return;
    if (!hasMedia) {
      setError('İlanı yayınlamadan önce en az bir görsel yüklemelisiniz.');
      return;
    }
    if (!selectedPortalIds.length) {
      setError('Yayınlamak için en az bir bağlı portal hesabı seçin.');
      return;
    }
    setAction('publish');
    setError(null);
    setNotice('Yayın kuyruğuna alınıyor...');
    try {
      const response = await authenticatedFetch(`listings/${listing.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalAccountIds: selectedPortalIds }),
      });
      if (!response.ok) throw new Error(await safeMessage(response));
      const data = await response.json() as QueueResponse;
      setNotice(`${jobCount(data, selectedPortalIds.length)} yayın işi kuyruğa alındı.`);
      setSelectedPortalIds([]);
      await load(true);
    } catch (exception) {
      setNotice(null);
      setError(exception instanceof Error ? exception.message : 'Yayınlama işlemi tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
      setAction(null);
    }
  }

  async function republish() {
    if (!listing || action) return;
    if (!hasMedia) {
      setError('İlanı yeniden yayınlamadan önce en az bir görsel yüklemelisiniz.');
      return;
    }
    if (!selectedPublicationIds.length) {
      setError('Yeniden göndermek için en az bir yayın kaydı seçin.');
      return;
    }
    setAction('republish');
    setError(null);
    setNotice('Yeniden yayına gönderiliyor...');
    try {
      const response = await authenticatedFetch(`listings/${listing.id}/republish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicationIds: selectedPublicationIds }),
      });
      if (!response.ok) throw new Error(await safeMessage(response));
      const data = await response.json() as QueueResponse;
      setNotice(`${jobCount(data, selectedPublicationIds.length)} yeniden yayın işi kuyruğa alındı.`);
      setSelectedPublicationIds([]);
      await load(true);
    } catch (exception) {
      setNotice(null);
      setError(exception instanceof Error ? exception.message : 'Yeniden yayınlama işlemi tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
      setAction(null);
    }
  }

  function togglePortal(accountId: string) {
    setSelectedPortalIds((current) => current.includes(accountId) ? current.filter((item) => item !== accountId) : [...current, accountId]);
  }

  function togglePublication(publicationId: string) {
    setSelectedPublicationIds((current) => current.includes(publicationId) ? current.filter((item) => item !== publicationId) : [...current, publicationId]);
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto h-96 max-w-6xl animate-pulse rounded-2xl bg-slate-200" /></main>;
  if (error && !listing) return <main className="min-h-screen bg-slate-50 p-8"><section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6"><h1 className="font-bold">İlan bilgileri alınamadı</h1><p className="mt-2 text-sm">{error}</p><button className="mt-4 rounded-lg border px-3 py-2 text-sm" onClick={() => void load()} type="button">Tekrar Dene</button></section></main>;
  if (!listing) return null;

  const publishing = listing.status === 'PUBLISHING';
  const canDelete = listing.status === 'DRAFT' || listing.status === 'ARCHIVED';
  const canPublish = listing.status === 'DRAFT' && hasMedia && selectedPortalIds.length > 0 && !action;
  const canRepublish = listing.status === 'ACTIVE' && hasMedia && selectedPublicationIds.length > 0 && !action;
  const housingDetails = buildListingDetailItems(listing.residentialDetails, listing.currency);

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10"><div className="mx-auto max-w-6xl">
    <Link className="text-sm font-semibold text-teal-700 hover:underline" href="/listings">← İlanlarıma dön</Link>
    {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <header className="mt-4 rounded-2xl border bg-white p-6"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div><p className="text-sm font-semibold text-slate-500">{listing.listingNo} · <span className="rounded-full bg-slate-100 px-2 py-1">{getListingStatusLabel(listing.status)}</span></p><h1 className="mt-2 text-3xl font-bold">{listing.title}</h1><strong className="mt-4 block text-xl">{money(listing.price, listing.currency)}</strong></div>
      <div className="flex flex-wrap gap-2 self-start">{publishing ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">İlan yayınlanıyor; durum işlemleri geçici olarak kapalı.</p> : <>
        {listing.status !== 'ARCHIVED' && <Link className="rounded-lg border px-3 py-2 text-sm font-semibold" href={`/listings/${listing.id}/edit`}>Düzenle</Link>}
        {listing.status !== 'ARCHIVED' && <Link className="rounded-lg border px-3 py-2 text-sm font-semibold" href={`/listings/${listing.id}/media`}>Fotoğrafları Yönet</Link>}
        {listing.status === 'DRAFT' && <a className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white" href="#portal-yayinlari">Yayınla</a>}
        {listing.status === 'ACTIVE' && republishablePublications.length > 0 && <a className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white" href="#portal-yayinlari">Yeniden Yayınla</a>}
        {listing.status !== 'ARCHIVED' && <button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={!!action} onClick={() => void changeStatus('ARCHIVED')} type="button">{action === 'ARCHIVED' ? 'Arşivleniyor...' : 'Arşivle'}</button>}
        {listing.status === 'ARCHIVED' && <><button className="rounded-lg border px-3 py-2 text-sm font-semibold" disabled={!!action} onClick={() => void changeStatus('DRAFT')} type="button">Taslağa Geri Al</button><button className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!canDelete || !!action} onClick={() => void remove()} type="button">{action === 'delete' ? 'Siliniyor...' : 'Sil'}</button></>}
      </>}</div></div></header>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Fotoğraf Galerisi</h2>{listing.media.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{listing.media.map((media) => <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100" key={media.id}><img alt={media.originalName ?? listing.title} className="h-full w-full object-cover" src={media.url} />{media.isCover && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-white">Kapak</span>}</div>)}</div> : <p className="mt-3 text-sm text-slate-600">Henüz fotoğraf yok.</p>}</section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Açıklama</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{listing.description}</p></section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Temel Bilgiler</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">İlan Tipi</dt><dd className="mt-1 text-sm font-semibold">{getListingTypeLabel(listing.listingType)}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">Taşınmaz Tipi</dt><dd className="mt-1 text-sm font-semibold">{getPropertyTypeLabel(listing.propertyType)}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">Durum</dt><dd className="mt-1 text-sm font-semibold">{getListingStatusLabel(listing.status)}</dd></div></dl></section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Konut Detayları</h2>{housingDetails.length ? <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{housingDetails.map((item) => <div className="rounded-xl bg-slate-50 p-3" key={item.key}><dt className="text-xs font-semibold text-slate-500">{item.label}</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{item.value}</dd></div>)}</dl> : <p className="mt-3 text-sm text-slate-600">Detay girilmemiş.</p>}</section>
      </div>
      <aside className="space-y-6">
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">Konum</h2><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-slate-500">Şehir</dt><dd>{listing.city}</dd></div><div><dt className="text-slate-500">İlçe</dt><dd>{listing.district}</dd></div>{listing.neighborhood && <div><dt className="text-slate-500">Mahalle</dt><dd>{listing.neighborhood}</dd></div>}<div><dt className="text-slate-500">Adres</dt><dd>{listing.address}</dd></div></dl></section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">Özellikler</h2>{featureGroups.some(([key]) => listing.features[key]?.length) ? featureGroups.map(([key, name]) => listing.features[key]?.length ? <div className="mt-4" key={key}><h3 className="text-sm font-semibold">{name}</h3><p className="mt-1 text-sm text-slate-600">{listing.features[key].map((feature) => feature.label).join(', ')}</p></div> : null) : <p className="mt-3 text-sm text-slate-600">Özellik seçilmemiş.</p>}</section>
        <section className="rounded-2xl border bg-white p-6" id="portal-yayinlari"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Portal Yayınları</h2><p className="mt-1 text-xs text-slate-500">{shouldPoll && !pollTimedOut ? 'Durumlar otomatik yenileniyor.' : 'Yayın durumlarını buradan takip edin.'}</p></div><button className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50" disabled={!!action} onClick={() => void load(true)} type="button">Durumu Yenile</button></div>
          {pollTimedOut && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Otomatik yenileme 2 dakika sonra durdu. Durumu manuel yenileyebilirsiniz.</p>}
          {!hasMedia && listing.status !== 'ARCHIVED' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">İlanı yayınlamadan önce en az bir görsel yüklemelisiniz. <Link className="font-semibold underline" href={`/listings/${listing.id}/media`}>Fotoğrafları Yönet</Link></p>}
          {listing.status === 'ARCHIVED' && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Arşivdeki ilan yayınlanamaz.</p>}
          {publishing && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">İlan yayınlanıyor. Yeni yayınlama ve yeniden yayınlama işlemleri geçici olarak kapalı.</p>}
          {listing.status === 'DRAFT' && <div className="mt-5 border-t pt-4"><h3 className="text-sm font-bold">Portala Yayınla</h3>{connectedAccounts.length ? <div className="mt-3 space-y-2">{connectedAccounts.map((account) => <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm" key={account.id}><input checked={selectedPortalIds.includes(account.id)} className="mt-1" disabled={!!action || !hasMedia || publishing} onChange={() => togglePortal(account.id)} type="checkbox" /><span><span className="block font-semibold">{account.portal.name}</span><span className="block text-xs text-slate-500">{account.portal.code} · {connectionStatusLabels[account.connectionStatus] ?? account.connectionStatus} · Son test: {date(account.lastCheckedAt)}</span></span></label>)}</div> : <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><p>Yayınlama için bağlı ve bağlantısı doğrulanmış bir portal hesabı gerekiyor.</p><Link className="mt-2 inline-block font-semibold text-teal-700 underline" href="/portal-accounts">Portal Hesaplarına Git</Link></div>}<button className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!canPublish} onClick={() => void publish()} type="button">{action === 'publish' ? 'Yayın kuyruğuna alınıyor...' : 'Yayınla'}</button></div>}
          {listing.status === 'ACTIVE' && republishablePublications.length > 0 && <div className="mt-5 border-t pt-4"><h3 className="text-sm font-bold">Yeniden Yayınla</h3><p className="mt-1 text-xs text-slate-500">Sadece başarısız veya güncelleme gereken yayınlar seçilebilir.</p><div className="mt-3 space-y-2">{republishablePublications.map((publication) => <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm" key={publication.id}><input checked={selectedPublicationIds.includes(publication.id)} className="mt-1" disabled={!!action || !hasMedia || publishing} onChange={() => togglePublication(publication.id)} type="checkbox" /><span><span className="block font-semibold">{publication.portalName}</span><span className="block text-xs text-slate-500">Portal ilan numarası: {publication.externalListingId ?? publication.id}</span><span className="block text-xs text-slate-500">Yayın durumu: {getPublicationStatusLabel(publication.status)}</span></span></label>)}</div><button className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!canRepublish} onClick={() => void republish()} type="button">{action === 'republish' ? 'Yeniden Yayına Gönderiliyor...' : 'Seçilenleri Yeniden Gönder'}</button></div>}
          <div className="mt-5 border-t pt-4"><h3 className="text-sm font-bold">Mevcut Yayınlar</h3>{publications.length ? <ul className="mt-3 space-y-3">{publications.map((publication) => { const linkState = getPublicationLinkState(publication.externalUrl); return <li className="rounded-lg bg-slate-50 p-3 text-sm" key={publication.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{publication.portalName}</p><p className="text-xs text-slate-500">Portal ilan numarası: {publication.externalListingId ?? publication.id}</p><p className="text-xs text-slate-500">Yayın durumu: {getPublicationStatusLabel(publication.status)}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{getPublicationStatusLabel(publication.status)}</span></div>{publication.lastError && <p className="mt-2 text-red-700">{publication.lastError}</p>}<p className="mt-2 text-xs text-slate-500">Yayın: {date(publication.publishedAt ?? publication.updatedAt)} · Son deneme: {date(publication.lastAttemptAt)}</p>{linkState.badge && <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{linkState.badge}</span>}{linkState.href ? <a className="mt-2 block text-teal-700 underline" href={linkState.href} rel="noreferrer" target="_blank">{linkState.label}</a> : <p className="mt-2 text-sm text-slate-600">{linkState.label}</p>}</li>; })}</ul> : <p className="mt-3 text-sm text-slate-600">Portal yayını yok.</p>}</div>
        </section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">Aktivite Geçmişi</h2>{history.length ? <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-4">{history.map((item) => <li key={item.id}><p className="font-semibold">{translateAuditAction(item.action)}</p><p className="text-sm text-slate-600">{item.actor ? `${item.actor.firstName} ${item.actor.lastName}` : 'Sistem'} · {date(item.createdAt)}</p>{item.changes && <p className="mt-1 text-sm text-slate-500">{formatListingActivityChanges(item.changes).join(' · ')}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-slate-600">Aktivite kaydı yok.</p>}</section>
      </aside>
    </div></div></main>;
}
