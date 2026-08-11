'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../layout/app-shell';
import { authenticatedFetch } from '../../lib/api-client';

type Listing = { id: string; listingNo: string; title: string; price: number; currency: string; status: string; city: string; district: string; listingDomain?: string };
const labels: Record<string, string> = { DRAFT: 'Taslak', PUBLISHING: 'Yayınlanıyor', ACTIVE: 'Aktif', ARCHIVED: 'Arşiv', SUSPENDED: 'Askıda', DELETED: 'Silindi' };

export function AdminListingsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [domainFilter, setDomainFilter] = useState<'ALL' | 'PROPERTY' | 'VEHICLE'>('ALL');

  async function load() {
    const r = await authenticatedFetch('listings/admin/all');
    if (!r.ok) {
      setError('İlanlar yüklenemedi.');
      setLoading(false);
      return;
    }
    const p = await r.json();
    setItems(p.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function change(id: string, status: string) {
    setSaving(id);
    const r = await authenticatedFetch(`listings/admin/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) setError('Durum değiştirilemedi.');
    await load();
    setSaving('');
  }

  async function remove(id: string) {
    if (!window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) return;
    setSaving(id);
    const r = await authenticatedFetch(`listings/admin/${id}`, { method: 'DELETE' });
    if (!r.ok) setError('İlan silinemedi.');
    await load();
    setSaving('');
  }

  const filteredItems = items.filter((i) => domainFilter === 'ALL' || (i.listingDomain || 'PROPERTY') === domainFilter);

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl p-6">
        <h1 className="text-3xl font-bold">Tüm İlanlar</h1>
        <p className="mb-6 mt-2 text-slate-600">Admin ilan detayını açabilir, düzenleyebilir, askıya alabilir veya silebilir.</p>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mb-4 flex gap-2">
          <button
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              domainFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setDomainFilter('ALL')}
            type="button"
          >
            Tümü
          </button>
          <button
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              domainFilter === 'PROPERTY' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setDomainFilter('PROPERTY')}
            type="button"
          >
            Gayrimenkul
          </button>
          <button
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              domainFilter === 'VEHICLE' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setDomainFilter('VEHICLE')}
            type="button"
          >
            Araç
          </button>
        </div>

        {loading ? (
          <p>Yükleniyor...</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4">İlan</th>
                  <th className="p-4">Konum</th>
                  <th className="p-4">Fiyat</th>
                  <th className="p-4">Durum</th>
                  <th className="p-4">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i) => (
                  <tr className="border-t" key={i.id}>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{i.title}</p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            i.listingDomain === 'VEHICLE' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {i.listingDomain === 'VEHICLE' ? 'Araç' : 'Gayrimenkul'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{i.listingNo}</p>
                    </td>
                    <td className="p-4">
                      {i.city} / {i.district}
                    </td>
                    <td className="p-4">
                      {i.price.toLocaleString('tr-TR')} {i.currency}
                    </td>
                    <td className="p-4">{labels[i.status] ?? i.status}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/listings/${i.id}`} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white">
                          Detay
                        </Link>
                        {i.status === 'ACTIVE' && (
                          <button disabled={saving === i.id} onClick={() => void change(i.id, 'SUSPENDED')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white">
                            Askıya al
                          </button>
                        )}
                        {i.status === 'SUSPENDED' && (
                          <button disabled={saving === i.id} onClick={() => void change(i.id, 'ACTIVE')} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">
                            Aktifleştir
                          </button>
                        )}
                        {['ACTIVE', 'SUSPENDED'].includes(i.status) && (
                          <button disabled={saving === i.id} onClick={() => void change(i.id, 'DRAFT')} className="rounded-lg border px-3 py-2 text-xs font-semibold">
                            Taslağa al
                          </button>
                        )}
                        {i.status !== 'DELETED' && (
                          <button disabled={saving === i.id} onClick={() => void remove(i.id)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white">
                            Sil
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredItems.length && <p className="p-6 text-slate-600">İlan bulunamadı.</p>}
          </div>
        )}
      </main>
    </AppShell>
  );
}
