'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearVerificationContext, readVerificationContext, saveVerificationContext, type StoredVerificationContext } from '../../../src/lib/verification-context';

type StatusResponse = {
  emailVerified: boolean;
  expiresAt: string | null;
  resendAvailableAt: string | null;
  attemptsRemaining: number;
  verificationContext?: string;
};

function formatCountdown(target: string | null): string {
  if (!target) return '0:00';
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const minutes = Math.floor(diff / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [context, setContext] = useState<StoredVerificationContext | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readVerificationContext();
    setContext(stored);
    if (!stored?.verificationContext && !stored?.email) {
      setNotice('Doğrulama oturumu bulunamadı. Lütfen tekrar kayıt olun veya giriş ekranından devam edin.');
      setHydrated(true);
      return;
    }
    void loadStatus(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!context?.resendAvailableAt) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [context?.resendAvailableAt]);

  const resendCountdown = useMemo(
    () => formatCountdown(context?.resendAvailableAt ?? status?.resendAvailableAt ?? null),
    [context?.resendAvailableAt, status?.resendAvailableAt, tick],
  );

  async function loadStatus(currentContext: StoredVerificationContext | null) {
    if (!currentContext?.verificationContext && !currentContext?.email) return;
    try {
      const response = await fetch('/api/auth/verification-status', {
        method: 'GET',
        headers: {
          ...(currentContext.verificationContext ? { 'x-verification-context': currentContext.verificationContext } : {}),
          ...(currentContext.email ? { 'x-verification-email': currentContext.email } : {}),
        },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as StatusResponse & { message?: string };
      if (!response.ok) {
        setError(typeof payload.message === 'string' ? payload.message : 'Doğrulama durumu alınamadı.');
        return;
      }
      setStatus(payload);
      if (payload.verificationContext) {
        const nextContext = { ...(currentContext ?? { email: '' }), verificationContext: payload.verificationContext };
        setContext(nextContext);
        saveVerificationContext(nextContext);
      }
    } catch {
      setError('Doğrulama durumu alınamadı.');
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context?.verificationContext || !context.email) {
      setError('Doğrulama oturumu bulunamadı.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Lütfen 6 haneli kodu girin.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: context.email, verificationContext: context.verificationContext, code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const codeName = (payload as { code?: string }).code;
        if (codeName === 'EMAIL_VERIFICATION_CODE_EXPIRED') setError('Kodun süresi doldu. Yeniden gönderin.');
        else if (codeName === 'EMAIL_VERIFICATION_CODE_USED') setError('Bu kod daha önce kullanıldı.');
        else if (codeName === 'EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED') setError('Deneme hakkınız tükendi. Yeniden kod isteyin.');
        else setError(typeof (payload as { message?: string }).message === 'string' ? (payload as { message: string }).message : 'Doğrulama tamamlanamadı.');
        return;
      }
      clearVerificationContext();
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!context?.verificationContext || !context.email) {
      setError('Doğrulama oturumu bulunamadı.');
      return;
    }
    setResending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: context.email, verificationContext: context.verificationContext }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const codeName = (payload as { code?: string }).code;
        if (codeName === 'EMAIL_VERIFICATION_RESEND_COOLDOWN') {
          setError('Yeniden gönderim için biraz bekleyin.');
        } else if (codeName === 'EMAIL_ALREADY_VERIFIED') {
          clearVerificationContext();
          router.push('/dashboard');
        } else {
          setError(typeof (payload as { message?: string }).message === 'string' ? (payload as { message: string }).message : 'Kod yeniden gönderilemedi.');
        }
        return;
      }
      const nextContext = {
        ...context,
        verificationContext: (payload as { verificationContext?: string }).verificationContext ?? context.verificationContext,
        expiresAt: (payload as { expiresAt?: string | null }).expiresAt ?? context.expiresAt,
        resendAvailableAt: (payload as { resendAvailableAt?: string | null }).resendAvailableAt ?? context.resendAvailableAt,
        mailDeliveryFailed: (payload as { mailDeliveryFailed?: boolean }).mailDeliveryFailed ?? false,
      };
      setContext(nextContext);
      saveVerificationContext(nextContext);
      setStatus((current) => current ? { ...current, verificationContext: nextContext.verificationContext, expiresAt: nextContext.expiresAt ?? current.expiresAt, resendAvailableAt: nextContext.resendAvailableAt ?? current.resendAvailableAt } : current);
      setNotice('Yeni doğrulama kodu gönderildi.');
    } catch {
      setError('Kod yeniden gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setResending(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#f8fafb] px-6 py-12 text-[#191c1d]">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#dbe2e3] bg-white p-8 shadow-sm">
          <p className="text-sm text-[#3c494a]">Doğrulama sayfası hazırlanıyor...</p>
        </div>
      </main>
    );
  }

  if (!context?.email && !status?.verificationContext) {
    return (
      <main className="min-h-screen bg-[#f8fafb] px-6 py-12 text-[#191c1d]">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#dbe2e3] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">E-posta doğrulama</h1>
          <p className="mt-3 text-sm text-[#3c494a]">{notice || 'Doğrulama oturumu bulunamadı.'}</p>
          <div className="mt-6 flex gap-3">
            <a className="rounded-xl bg-[#00696e] px-4 py-3 text-sm font-semibold text-white" href="/register">Kayıta dön</a>
            <a className="rounded-xl border border-[#bbc9ca] px-4 py-3 text-sm font-semibold text-[#191c1d]" href="/login">Giriş yap</a>
          </div>
        </div>
      </main>
    );
  }

  const resendEnabled = !context?.resendAvailableAt || Date.now() >= new Date(context.resendAvailableAt).getTime();

  return (
    <main className="min-h-screen bg-[#f8fafb] px-6 py-10 text-[#191c1d]">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="rounded-3xl border border-[#dbe2e3] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00696e]">Doğrulama</p>
          <h1 className="mt-2 text-3xl font-bold">E-postanızı doğrulayın</h1>
          <p className="mt-3 text-sm text-[#3c494a]">
            {context?.email ? `${context.email} adresine gönderilen 6 haneli kodu girin.` : 'E-posta adresinize gönderilen 6 haneli kodu girin.'}
          </p>
          {status?.emailVerified && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">E-posta zaten doğrulanmış.</p>}
          {notice && <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">{notice}</p>}
          {context?.mailDeliveryFailed && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Doğrulama e-postası gönderilemedi. Yeniden gönder seçeneğini kullanabilirsiniz.</p>}
        </header>

        <section className="rounded-3xl border border-[#dbe2e3] bg-white p-6 shadow-sm">
          {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          <form className="flex flex-col gap-5" onSubmit={handleVerify}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#3c494a]">Doğrulama kodu</span>
              <input
                className="w-full rounded-2xl border border-[#bbc9ca] bg-[#f8fafb] px-4 py-4 text-center text-2xl font-bold tracking-[0.35em] outline-none focus:border-[#00696e] focus:ring-4 focus:ring-[#00696e]/10"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                value={code}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#3c494a]">
              <span>Deneme hakkı: {status?.attemptsRemaining ?? 5}</span>
              <span>Yeniden gönderim: {context?.resendAvailableAt || status?.resendAvailableAt ? resendCountdown : '0:00'}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-xl bg-[#00696e] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={loading || code.length !== 6} type="submit">
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </button>
              <button className="rounded-xl border border-[#bbc9ca] px-5 py-3 text-sm font-semibold text-[#191c1d] disabled:cursor-not-allowed disabled:opacity-60" disabled={resending || !resendEnabled} onClick={() => void handleResend()} type="button">
                {resending ? 'Gönderiliyor...' : 'Kodu yeniden gönder'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

