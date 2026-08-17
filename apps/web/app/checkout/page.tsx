'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { AppShell } from '../../src/components/layout/app-shell';
import { authenticatedFetch } from '../../src/lib/api-client';
import { CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

type Plan = {
  id: string;
  name: string;
  monthlyPrice: number;
  listingLimit: number;
  portalLimit: number;
  period: string;
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoadingFallback />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('planId');
  
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!planId) {
      setError('Geçersiz paket seçimi.');
      setLoading(false);
      return;
    }

    async function loadPlan() {
      try {
        const res = await authenticatedFetch(`plans/${planId}`);
        if (!res.ok) throw new Error('Seçilen paket bilgileri alınamadı.');
        const data = await res.json() as Plan;
        setPlan(data);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }

    void loadPlan();
  }, [planId]);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <Link href="/plans" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-teal-700 transition mb-6">
            <ArrowLeft size={14} />
            Paketlere Geri Dön
          </Link>

          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-600 mb-4">
            <CreditCard size={24} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">Güvenli Ödeme Adımı</h1>
          <p className="text-sm text-slate-500 mb-6">Paket aboneliğinizi başlatmak için ödeme aşaması.</p>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
              <span>Paket detayları yükleniyor...</span>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-100 mb-6">
              {error}
            </div>
          ) : plan ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seçilen Paket</div>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-lg text-slate-800">{plan.name}</span>
                  <div>
                    <span className="font-extrabold text-xl text-teal-700">
                      {Number(plan.monthlyPrice).toLocaleString('tr-TR')} TL
                    </span>
                    <span className="text-xs text-slate-500 font-medium"> / {plan.period}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm font-bold text-amber-800 mb-1">Bilgilendirme</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Ödeme altyapısı yakında devreye alınacaktır.
                </p>
              </div>

              <div className="text-xs text-slate-400 text-center leading-relaxed">
                Bu aşamada kartınızdan herhangi bir tahsilat yapılmamıştır. Ödeme altyapımız tamamlandığında size e-posta ile bilgilendirme yapılacaktır.
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}

function CheckoutLoadingFallback() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            <span>Paket detayları yükleniyor...</span>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
