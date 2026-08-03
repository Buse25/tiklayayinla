'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';

type Media = { id: string; url: string; sortOrder: number; isCover: boolean; originalName?: string | null };
type Publication = { id: string; status: string; externalUrl?: string | null; lastError?: string | null; publishedAt?: string | null; updatedAt: string; portal: { name: string; code: string } };
type Feature = { code: string; label: string };
type Listing = {
  id: string; listingNo: string; title: string; description: string; price: number; currency: string;
  listingType: string; propertyType: string; city: string; district: string; neighborhood?: string | null;
  address: string; status: string; createdAt: string; media: Media[]; publications: Publication[];
  residentialDetails?: Record<string, string | number | boolean | null> | null;
  features: Record<string, Feature[]>;
};

const statusLabel: Record<string, string> = { DRAFT: 'Taslak', ACTIVE: 'Aktif', ARCHIVED: 'Arşivlendi' };
const publicationLabel: Record<string, string> = { PENDING: 'Sırada', PROCESSING: 'Yayınlanıyor', PUBLISHED: 'Yayınlandı', FAILED: 'Başarısız', CANCELLED: 'İptal edildi' };

function price(value: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function load() {
      setLoading(true); setError(null);
      try {
        const response = await authenticatedFetch(`listings/${id}`);
        if (!response.ok) {
          if (response.status !== 401 && active) setError(response.status === 404 ? 'İlan bulunamadı veya bu ilana erişim izniniz yok.' : 'İlan detayı alınamadı.');
          return;
        }
        const data = await response.json() as Listing;
        if (active) setListing(data);
      } catch {
        if (active) setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  if (loading) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto h-96 max-w-6xl animate-pulse rounded-2xl bg-slate-200" /></main>;
  if (error || !listing) return <main className="min-h-screen bg-slate-50 p-8"><section className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h1 className="font-bold">İlan açılamadı</h1><p className="mt-2 text-sm">{error}</p><Link className="mt-5 inline-block font-semibold underline" href="/listings">İlanlarıma dön</Link></section></main>;

  const features = Object.values(listing.features ?? {}).flat();
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10"><div className="mx-auto max-w-6xl">
    <Link className="text-sm font-semibold text-teal-700 hover:underline" href="/listings">← İlanlarıma dön</Link>
    <header className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-slate-500">{listing.listingNo} · {statusLabel[listing.status] ?? listing.status}</p><h1 className="mt-1 text-3xl font-bold">{listing.title}</h1><p className="mt-2 text-slate-600">{listing.district}, {listing.city}</p><strong className="mt-4 block text-xl">{price(listing.price, listing.currency)}</strong></div><Link className="inline-flex justify-center rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800" href={`/listings/${listing.id}/media`}>Fotoğrafları yönet</Link></header>

    <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]"><div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">İlan açıklaması</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{listing.description}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Fotoğraflar</h2>{listing.media.length === 0 ? <p className="mt-3 text-sm text-slate-600">Henüz fotoğraf yüklenmedi.</p> : <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{listing.media.map((item) => <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100" key={item.id}><img alt={item.originalName || listing.title} className="h-full w-full object-cover" src={item.url} />{item.isCover && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs font-semibold text-white">Kapak</span>}</div>)}</div>}</section></div>
      <aside className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Konum</h2><p className="mt-3 text-sm text-slate-700">{listing.address}</p>{listing.neighborhood && <p className="mt-1 text-sm text-slate-600">{listing.neighborhood}</p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Özellikler</h2>{features.length ? <ul className="mt-3 space-y-2 text-sm text-slate-700">{features.map((feature) => <li key={feature.code}>{feature.label}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Ek özellik girilmemiş.</p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Yayın durumları</h2>{listing.publications.length ? <ul className="mt-3 space-y-3">{listing.publications.map((publication) => <li className="rounded-lg bg-slate-50 p-3 text-sm" key={publication.id}><p className="font-semibold">{publication.portal.name}</p><p className="mt-1 text-slate-600">{publicationLabel[publication.status] ?? publication.status}</p>{publication.lastError && <p className="mt-1 text-red-700">{publication.lastError}</p>}{publication.externalUrl && <a className="mt-1 inline-block text-teal-700 underline" href={publication.externalUrl} rel="noreferrer" target="_blank">Portalda görüntüle</a>}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Henüz portal yayını yok.</p>}</section></aside>
    </div>
  </div></main>;
}
