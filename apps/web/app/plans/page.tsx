'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../src/components/layout/app-shell';
import { authenticatedFetch } from '../../src/lib/api-client';
import { Check, CreditCard, ChevronRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

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

type Profile = {
  id: string;
  email: string;
  currentPlan?: {
    id: string;
    name: string;
    status: string;
  } | null;
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [plansRes, profileRes] = await Promise.all([
        authenticatedFetch('plans'),
        authenticatedFetch('users/me'),
      ]);

      if (!plansRes.ok) throw new Error('Paketler yüklenemedi.');
      if (!profileRes.ok) throw new Error('Kullanıcı bilgisi alınamadı.');

      const plansData = await plansRes.json() as Plan[];
      const profileData = await profileRes.json() as Profile;

      setPlans(plansData);
      setProfile(profileData);
    } catch (err: unknown) {
      console.error('Error loading plans/profile:', err);
      setError(err instanceof Error ? err.message : 'Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSelectPlan(planId: string) {
    if (selectingId) return;
    setSelectingId(planId);
    setError('');
    setSuccess('');

    try {
      const res = await authenticatedFetch(`plans/${planId}/select`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null) as { message?: string | string[] } | null;
        const message = errorData?.message;
        throw new Error(Array.isArray(message) ? message.join(' ') : message || 'Paket seçilemedi.');
      }

      setSuccess('Paket başarıyla seçildi! Ödeme adımına yönlendiriliyorsunuz...');
      
      // Refresh profile state
      const profileRes = await authenticatedFetch('users/me');
      if (profileRes.ok) {
        setProfile(await profileRes.json() as Profile);
      }
      
      // Dispatch profile updated event so sidebar updates
      window.dispatchEvent(new Event('profile-updated'));

      // Redirect to checkout page
      setTimeout(() => {
        window.location.assign(`/checkout?planId=${planId}`);
      }, 1500);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Paket seçilirken bir hata oluştu.');
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <p className="text-sm font-semibold text-teal-700">ÜYELİK VE ABONELİK</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Üyelik Paketleri</h1>
            <p className="mt-2 text-sm text-slate-500">İhtiyacınıza en uygun paketi seçin, ilanlarınızı tüm portallarda hemen yayınlayın.</p>
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

          {loading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-2xl border p-6 h-96 animate-pulse" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 shadow-sm">
              Aktif paket bulunmuyor.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3 items-stretch">
              {plans.map((plan) => {
                const isCurrent = profile?.currentPlan?.id === plan.id;
                const isPending = profile?.currentPlan?.status === 'PENDING_PAYMENT';
                
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col justify-between bg-white rounded-2xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                      isCurrent ? 'border-2 border-teal-600 ring-2 ring-teal-100' : 'border-slate-200'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                        Mevcut Seçiminiz
                      </span>
                    )}

                    <div>
                      <div className="mb-4">
                        <h3 className="font-bold text-xl text-slate-900">{plan.name}</h3>
                        <p className="mt-1 text-xs text-slate-500 font-medium">Bireysel ve Kurumsal Kullanım</p>
                      </div>

                      <div className="mb-6">
                        <span className="text-4xl font-extrabold text-teal-700">
                          {Number(plan.monthlyPrice).toLocaleString('tr-TR')} TL
                        </span>
                        <span className="text-sm text-slate-500 font-medium"> / {plan.period}</span>
                      </div>

                      <div className="space-y-4 mb-8">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Plan Limitleri</div>
                        <ul className="text-sm space-y-3 text-slate-600">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-teal-600 shrink-0" />
                            <span><strong>{plan.listingLimit === 999999 ? 'Sınırsız' : plan.listingLimit}</strong> İlan Limiti</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-teal-600 shrink-0" />
                            <span><strong>{plan.portalLimit}</strong> Portal Entegrasyonu</span>
                          </li>
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-teal-600 shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100">
                      {isCurrent ? (
                        <div className="space-y-2">
                          <div className={`text-center py-3 px-4 rounded-xl text-sm font-bold border ${
                            isPending 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}>
                            {isPending ? 'Ödeme Bekliyor' : 'Aktif'}
                          </div>
                          <Link
                            href={`/checkout?planId=${plan.id}`}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition"
                          >
                            <CreditCard size={16} />
                            Ödeme Sayfasına Git
                          </Link>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectPlan(plan.id)}
                          disabled={!!selectingId}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-sm font-bold text-white hover:bg-teal-800 transition disabled:opacity-50"
                        >
                          Paketi İncele & Seç
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
