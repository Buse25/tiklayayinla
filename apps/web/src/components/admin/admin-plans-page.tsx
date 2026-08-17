'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../layout/app-shell';
import { authenticatedFetch } from '../../lib/api-client';
import { AppNavigation } from '../navigation/app-navigation';
import { Edit2, Trash2, Check, ShieldAlert } from 'lucide-react';

type Plan = {
  id: string;
  name: string;
  monthlyPrice: number;
  listingLimit: number;
  portalLimit: number;
  features: string[];
  period: string;
  isActive: boolean;
};

export function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [listingLimit, setListingLimit] = useState(0);
  const [portalLimit, setPortalLimit] = useState(0);
  const [featuresText, setFeaturesText] = useState('');
  const [period, setPeriod] = useState('aylık');
  const [isActive, setIsActive] = useState(true);

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await authenticatedFetch('plans/admin');
      if (!res.ok) {
        let errorBody = '';
        try {
          errorBody = await res.text();
        } catch {}
        console.error('API Error Response for GET plans/admin:', {
          status: res.status,
          statusText: res.statusText,
          body: errorBody,
        });
        throw new Error(`Paketler yüklenemedi. HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json() as Plan[];
      setPlans(data);
    } catch (err: unknown) {
      console.error('Error in loadPlans:', err);
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  function resetForm() {
    setName('');
    setMonthlyPrice(0);
    setListingLimit(0);
    setPortalLimit(0);
    setFeaturesText('');
    setPeriod('aylık');
    setIsActive(true);
    setEditId(null);
  }

  function handleEdit(plan: Plan) {
    setEditId(plan.id);
    setName(plan.name);
    setMonthlyPrice(Number(plan.monthlyPrice));
    setListingLimit(plan.listingLimit);
    setPortalLimit(plan.portalLimit);
    setFeaturesText(plan.features.join('\n'));
    setPeriod(plan.period);
    setIsActive(plan.isActive);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const parsedFeatures = featuresText
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    const payload = {
      name,
      monthlyPrice: Number(monthlyPrice),
      listingLimit: Number(listingLimit),
      portalLimit: Number(portalLimit),
      features: parsedFeatures,
      period,
      isActive,
    };

    try {
      const url = editId ? `plans/${editId}` : 'plans';
      const method = editId ? 'PATCH' : 'POST';

      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null) as { message?: string | string[] } | null;
        const message = errorData?.message;
        throw new Error(Array.isArray(message) ? message.join(' ') : message || 'Paket kaydedilemedi.');
      }

      setSuccess(editId ? 'Paket başarıyla güncellendi!' : 'Yeni paket başarıyla oluşturuldu!');
      resetForm();
      await loadPlans();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'İşlem sırasında bir hata oluştu.');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Bu paketi pasife çekmek istediğinize emin misiniz?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await authenticatedFetch(`plans/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Paket pasife çekilemedi.');
      }

      setSuccess('Paket başarıyla pasife çekildi.');
      await loadPlans();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Silme işlemi başarısız.');
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-700">YÖNETİM</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">Üyelik Paketleri</h1>
              <p className="mt-1 text-sm text-slate-500">Abonelik planlarını yönetin, özellik ve fiyatlarını güncelleyin.</p>
            </div>
            <AppNavigation activeHref="/admin/plans" role="ADMIN" />
          </header>

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-xl bg-teal-50 p-4 text-sm text-teal-800 border border-teal-200">
              {success}
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Plan List */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Mevcut Paketler</h2>
              {loading ? (
                <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 shadow-sm">
                  Yükleniyor...
                </div>
              ) : plans.length === 0 ? (
                <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 shadow-sm">
                  Kayıtlı paket bulunmuyor. Sağdaki formu kullanarak yeni bir paket ekleyin.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col justify-between bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
                        !plan.isActive ? 'opacity-60 border-slate-200 bg-slate-50' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-lg text-slate-800">{plan.name}</h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              plan.isActive
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {plan.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>
                        <div className="mb-4">
                          <span className="text-2xl font-extrabold text-teal-700">
                            {Number(plan.monthlyPrice).toLocaleString('tr-TR')} TL
                          </span>
                          <span className="text-xs text-slate-500 font-medium"> / {plan.period}</span>
                        </div>
                        <ul className="text-xs space-y-1.5 text-slate-600 mb-6 bg-slate-50 rounded-xl p-3">
                          <li><strong>İlan Limiti:</strong> {plan.listingLimit === 999999 ? 'Sınırsız' : plan.listingLimit}</li>
                          <li><strong>Portal Limiti:</strong> {plan.portalLimit}</li>
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-teal-600" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-2 border-t pt-3 mt-auto">
                        <button
                          onClick={() => handleEdit(plan)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                        >
                          <Edit2 size={12} />
                          Düzenle
                        </button>
                        {plan.isActive && (
                          <button
                            onClick={() => handleDelete(plan.id)}
                            className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition"
                            title="Paketi Pasifleştir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Editor Form */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm self-start">
              <h2 className="text-xl font-bold text-slate-800 mb-4">
                {editId ? 'Paketi Düzenle' : 'Yeni Paket Ekle'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Paket Adı</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Eko Paket, Plus, Pro"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Fiyat (TL)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={monthlyPrice}
                      onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Süre/Periyot</label>
                    <input
                      type="text"
                      required
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="aylık, yıllık"
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">İlan Limiti</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={listingLimit}
                      onChange={(e) => setListingLimit(Number(e.target.value))}
                      placeholder="999999 = Sınırsız"
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Portal Limiti</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={portalLimit}
                      onChange={(e) => setPortalLimit(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Özellikler (Her satıra bir tane)
                  </label>
                  <textarea
                    rows={4}
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    placeholder="100 İlan&#10;10 Portal Entegrasyonu&#10;7/24 Destek"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none font-mono text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="isActiveCheck" className="text-sm font-semibold text-slate-700 cursor-pointer">
                    Paket Kullanıma Açık (Aktif)
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-teal-700 px-4 py-3 font-bold text-white hover:bg-teal-800 transition text-sm text-center"
                  >
                    {editId ? 'Güncelle' : 'Kaydet'}
                  </button>
                  {editId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 transition text-sm"
                    >
                      İptal
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
