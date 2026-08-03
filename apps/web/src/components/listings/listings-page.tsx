'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';

type ListingMedia = { id: string; url: string; sortOrder: number; isCover?: boolean };
type Listing = {
  id: string;
  listingNo: string;
  title: string;
  city: string;
  district: string;
  price: number;
  currency: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  media: ListingMedia[];
};
type ListingsResponse = { data: Listing[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

const statusLabels: Record<Listing['status'], string> = { DRAFT: 'Taslak', ACTIVE: 'Aktif', ARCHIVED: 'Arşivlendi' };
const statusStyles: Record<Listing['status'], string> = { DRAFT: 'bg-amber-50 text-amber-800 ring-amber-200', ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-200', ARCHIVED: 'bg-slate-100 text-slate-700 ring-slate-200' };

function coverImage(media: ListingMedia[]): ListingMedia | undefined {
  return media.find((item) => item.isCover) ?? [...media].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value));
}

export function ListingsPage() {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<ListingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        const response = await authenticatedFetch(`listings?page=${page}&limit=12`);
        if (!response.ok) {
          if (response.status !== 401) setError('İlanlar yüklenemedi. Lütfen tekrar deneyin.');
          return;
        }
        const payload = await response.json() as ListingsResponse;
        if (active) setResult(payload);
      } catch {
        if (active) setError('İlanlar yüklenirken bağlantı sorunu oluştu.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadListings();
    return () => { active = false; };
  }, [page, reloadKey]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">PORTFÖY</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">İlanlarım</h1>
            {!isLoading && result && <p className="mt-2 text-sm text-slate-600">Toplam {result.pagination.total} ilan</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={isLoggingOut} onClick={() => void logout()} type="button">{isLoggingOut ? 'Çıkış yapılıyor...' : 'Çıkış yap'}</button>
          <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800" href="/listings/new">
            <span className="material-symbols-rounded text-[20px]">add_home</span>
            Yeni İlan Oluştur
          </Link>
          </div>
        </header>

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="İlanlar yükleniyor">{Array.from({ length: 6 }).map((_, index) => <div className="h-64 animate-pulse rounded-2xl bg-slate-200" key={index} />)}</div>}

        {!isLoading && error && <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800" role="alert"><h2 className="font-semibold">İlanlar alınamadı</h2><p className="mt-1 text-sm">{error}</p><button className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold hover:bg-red-100" onClick={() => setReloadKey((current) => current + 1)} type="button">Tekrar dene</button></section>}

        {!isLoading && !error && result?.data.length === 0 && <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="material-symbols-rounded text-5xl text-slate-400">home_work</span><h2 className="mt-4 text-xl font-bold">Henüz ilan oluşturmadınız</h2><p className="mt-2 text-sm text-slate-600">İlk portföy kaydınızı oluşturarak başlayın.</p><Link className="mt-6 inline-flex rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800" href="/listings/new">Yeni İlan Oluştur</Link></section>}

        {!isLoading && !error && result && result.data.length > 0 && <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.data.map((listing) => {
              const cover = coverImage(listing.media);
              return <Link className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href={`/listings/${listing.id}`} key={listing.id}>
                <div className="relative flex h-44 items-center justify-center bg-slate-100">
                  {cover ? <img alt="" className="h-full w-full object-cover" src={cover.url} /> : <span className="material-symbols-rounded text-5xl text-slate-400">image</span>}
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyles[listing.status]}`}>{statusLabels[listing.status]}</span>
                </div>
                <div className="p-5"><p className="text-xs font-semibold text-slate-500">{listing.listingNo}</p><h2 className="mt-1 truncate text-lg font-bold group-hover:text-teal-700">{listing.title}</h2><p className="mt-2 text-sm text-slate-600">{listing.district}, {listing.city}</p><div className="mt-5 flex items-end justify-between gap-3"><strong className="text-base">{formatPrice(listing.price, listing.currency)}</strong><time className="text-xs text-slate-500" dateTime={listing.createdAt}>{formatDate(listing.createdAt)}</time></div></div>
              </Link>;
            })}
          </section>

          {result.pagination.totalPages > 1 && <nav aria-label="İlan sayfaları" className="mt-8 flex items-center justify-center gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" disabled={result.pagination.page === 1} onClick={() => setPage((current) => current - 1)} type="button">Önceki</button><span className="text-sm text-slate-600">Sayfa {result.pagination.page} / {result.pagination.totalPages}</span><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40" disabled={result.pagination.page === result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Sonraki</button></nav>}
        </>}
      </div>
    </main>
  );
}
