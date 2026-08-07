'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { enumOptions, featureCategories } from '../../../../src/data/listing-form-options';
import { authenticatedFetch } from '../../../../src/lib/api-client';

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  city: string;
  district: string;
  neighborhood?: string | null;
  address: string;
  residentialDetails?: Record<string, unknown> | null;
  features: Record<string, Array<{ code: string }>>;
};

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [listing, setListing] = useState<Listing | null>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const response = await authenticatedFetch(`listings/${id}`);
        if (!response.ok) throw new Error(response.status === 404 ? 'İlan bulunamadı.' : 'İlan bilgileri alınamadı.');
        const value = await response.json() as Listing;
        setListing(value);
        setData({
          title: value.title,
          description: value.description,
          price: String(value.price),
          currency: value.currency,
          city: value.city,
          district: value.district,
          neighborhood: value.neighborhood ?? '',
          address: value.address,
          roomCount: String(value.residentialDetails?.roomCount ?? ''),
          grossArea: String(value.residentialDetails?.grossArea ?? ''),
          netArea: String(value.residentialDetails?.netArea ?? ''),
        });
        setFeatures(Object.fromEntries(featureCategories.map((category) => [category.key, value.features[category.key]?.map((item) => item.code) ?? []])));
      } catch (exception) {
        setError(exception instanceof Error ? exception.message : 'İlan bilgileri alınamadı.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function set(key: string, value: string) {
    setData((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: string, value: string) {
    setFeatures((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!listing || saving) return;
    setError('');
    setSaving(true);
    try {
      const residentialDetails = Object.fromEntries([
        ['roomCount', data.roomCount.trim()],
        ['grossArea', data.grossArea.trim() ? Number(data.grossArea) : undefined],
        ['netArea', data.netArea.trim() ? Number(data.netArea) : undefined],
      ].filter(([, value]) => value !== '' && value !== undefined));
      const response = await authenticatedFetch(`listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description.trim(),
          price: Number(data.price),
          currency: data.currency,
          city: data.city.trim(),
          district: data.district.trim(),
          neighborhood: data.neighborhood.trim(),
          address: data.address.trim(),
          residentialDetails,
          ...features,
        }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? 'Yayınlanmakta olan ilan güncellenemez.' : response.status === 422 ? 'Form alanlarını kontrol edin.' : 'İlan güncellenemedi.');
      const result = await response.json();
      const count = result.publicationSync?.affectedPublications ?? 0;
      if (result.publicationSync?.required) {
        setNotice(`İlan bilgileri güncellendi. ${count} portal yayınının yeniden gönderilmesi gerekiyor.`);
      } else {
        router.push(`/listings/${listing.id}`);
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'İlan güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto h-96 max-w-4xl animate-pulse rounded-2xl bg-slate-200" /></main>;
  if (!listing) return <main className="min-h-screen bg-slate-50 p-8"><p className="rounded-xl bg-red-50 p-5 text-red-700">{error || 'İlan bulunamadı.'}</p></main>;

  return <main className="min-h-screen bg-slate-50 p-6"><form className="mx-auto max-w-4xl rounded-2xl border bg-white p-6" onSubmit={submit}><header className="mb-6 flex items-center justify-between"><div><h1 className="text-2xl font-bold">İlanı Düzenle</h1><p className="text-sm text-slate-600">{listing.title}</p></div><Link className="text-sm font-semibold text-teal-700" href={`/listings/${listing.id}`}>İptal</Link></header>{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><p>{notice}</p><Link className="mt-2 inline-block font-semibold underline" href={`/listings/${listing.id}`}>İlan detayına dön</Link></div>}<div className="grid gap-4 sm:grid-cols-2">{[['title', 'Başlık'], ['price', 'Fiyat'], ['city', 'Şehir'], ['district', 'İlçe'], ['neighborhood', 'Mahalle'], ['address', 'Açık adres'], ['roomCount', 'Oda sayısı'], ['grossArea', 'Brüt alan'], ['netArea', 'Net alan']].map(([key, label]) => <label className="flex flex-col gap-1 text-sm font-semibold" key={key}>{label}<input className="rounded-lg border p-2 font-normal" onChange={(e) => set(key, e.target.value)} type={['price', 'grossArea', 'netArea'].includes(key) ? 'number' : 'text'} value={data[key] ?? ''} /></label>)}<label className="flex flex-col gap-1 text-sm font-semibold">Para birimi<select className="rounded-lg border p-2 font-normal" onChange={(e) => set('currency', e.target.value)} value={data.currency}>{enumOptions.currency.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><label className="mt-4 flex flex-col gap-1 text-sm font-semibold">Açıklama<textarea className="min-h-32 rounded-lg border p-2 font-normal" onChange={(e) => set('description', e.target.value)} value={data.description ?? ''} /></label><section className="mt-6 border-t pt-5"><h2 className="font-bold">Özellik seçimleri</h2><div className="mt-3 grid gap-4 sm:grid-cols-2">{featureCategories.map((category) => <fieldset key={category.key}><legend className="text-sm font-semibold">{category.label}</legend><div className="mt-2 flex flex-wrap gap-2">{category.options.map((option) => <label className="rounded border px-2 py-1 text-xs" key={option.value}><input checked={features[category.key]?.includes(option.value) ?? false} className="mr-1" onChange={() => toggle(category.key, option.value)} type="checkbox" />{option.label}</label>)}</div></fieldset>)}</div></section><button className="mt-6 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={saving || !!notice} type="submit">{saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</button></form></main>;
}
