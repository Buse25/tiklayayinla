'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';

type DashboardSummary = {
  listings: { total: number; draft: number; publishing: number; active: number; archived: number };
  portalAccounts: { total: number; connected: number; failed: number; notTested: number };
  publications: { total: number; queued: number; processing: number; published: number; failed: number };
  recentPublications: Array<{ publicationId: string; listingId: string; listingTitle: string; portalName: string; status: string; externalUrl: string | null; publishedAt: string | null; updatedAt: string }>;
  recentErrors: Array<{ publicationId: string; listingId: string; listingTitle: string; portalName: string; lastError: string | null; updatedAt: string }>;
};

const publicationLabels: Record<string, string> = { PENDING: 'Bekliyor', QUEUED: 'Sırada', PROCESSING: 'Yayınlanıyor', PUBLISHED: 'Yayınlandı', FAILED: 'Başarısız', UNPUBLISHED: 'Yayından kaldırıldı' };
const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const response = await authenticatedFetch('dashboard/summary');
        if (!response.ok) { if (response.status !== 401 && active) setError(true); return; }
        const payload = await response.json() as DashboardSummary;
        if (active) setSummary(payload);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [reloadKey]);

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-teal-700">GENEL BAKIŞ</p><h1 className="mt-1 text-3xl font-bold">Dashboard</h1></div><nav className="flex flex-wrap gap-3"><Link className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center font-semibold text-slate-800 hover:bg-slate-100" href="/profile">Profil</Link><Link className="rounded-xl bg-teal-700 px-5 py-3 text-center font-semibold text-white hover:bg-teal-800" href="/listings">İlanlarıma git</Link></nav></header>{loading && <DashboardSkeleton />}{!loading && error && <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h2 className="font-bold">Dashboard verileri alınamadı</h2><p className="mt-2 text-sm">Lütfen bağlantınızı kontrol edip tekrar deneyin.</p><button className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold hover:bg-red-100" onClick={() => setReloadKey((value) => value + 1)} type="button">Tekrar dene</button></section>}{!loading && !error && summary && <DashboardContent summary={summary} />}</div></main>;
}

function DashboardContent({ summary }: { summary: DashboardSummary }) {
  const cards = [
    ['Toplam ilan', summary.listings.total],
    ['Taslak ilan', summary.listings.draft],
    ['Yayınlanıyor', summary.listings.publishing],
    ['Aktif ilan', summary.listings.active],
    ['Portal hesapları', summary.portalAccounts.total],
  ];
  return <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label as string}><p className="text-sm text-slate-600">{label}</p><strong className="mt-2 block text-3xl">{value}</strong></article>)}</section>{summary.listings.total === 0 && <Empty className="mt-6" message="Henüz ilan oluşturmadınız" link="/listings/new" linkLabel="Yeni ilan oluştur" />}{summary.portalAccounts.total === 0 && <Empty className="mt-6" message="Henüz portal hesabı bağlanmadı" link="/portal-accounts" linkLabel="Portal hesabı bağla" />}
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Yayın durumları</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Sırada" value={summary.publications.queued} /><Metric label="Yayınlanıyor" value={summary.publications.processing} /><Metric label="Yayınlandı" value={summary.publications.published} /><Metric label="Başarısız" value={summary.publications.failed} /><Metric label="Bağlı portal" value={summary.portalAccounts.connected} /></div></section>
    <section className="mt-6 grid gap-6 lg:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Son yayınlar</h2>{summary.recentPublications.length === 0 ? <p className="mt-4 text-sm text-slate-600">Henüz yayın işlemi bulunmuyor</p> : <ul className="mt-4 divide-y divide-slate-100">{summary.recentPublications.map((item) => <li className="py-3" key={item.publicationId}><Link className="font-semibold hover:text-teal-700" href={`/listings/${item.listingId}`}>{item.listingTitle}</Link><p className="mt-1 text-sm text-slate-600">{item.portalName} · {publicationLabels[item.status] ?? item.status}</p><time className="mt-1 block text-xs text-slate-500" dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time></li>)}</ul>}</article><article className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Son yayın hataları</h2>{summary.recentErrors.length === 0 ? <p className="mt-4 text-sm text-slate-600">Yayın hatası bulunmuyor</p> : <ul className="mt-4 divide-y divide-slate-100">{summary.recentErrors.map((item) => <li className="py-3" key={item.publicationId}><Link className="font-semibold hover:text-teal-700" href={`/listings/${item.listingId}`}>{item.listingTitle}</Link><p className="mt-1 text-sm text-slate-600">{item.portalName}</p><p className="mt-1 text-sm text-red-700">{item.lastError || 'Yayın işlemi başarısız oldu.'}</p><time className="mt-1 block text-xs text-slate-500" dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time></li>)}</ul>}</article></section></>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></div>; }
function Empty({ message, className, link, linkLabel }: { message: string; className?: string; link?: string; linkLabel?: string }) { return <section className={`${className ?? ''} rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center`}><p className="text-slate-600">{message}</p>{link && <Link className="mt-4 inline-block font-semibold text-teal-700 hover:underline" href={link}>{linkLabel}</Link>}</section>; }
function DashboardSkeleton() { return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div className="h-28 animate-pulse rounded-2xl bg-slate-200" key={index} />)}</div><div className="h-48 animate-pulse rounded-2xl bg-slate-200" /><div className="grid gap-6 lg:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /></div></div>; }
