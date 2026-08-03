'use client';

import { LoginForm } from '../../src/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafb] px-6 py-10 text-[#191c1d] sm:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#00696e]/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#00c4cc]/10 blur-3xl" />
      </div>

      <main className="flex w-full max-w-md flex-col items-center">
        <header className="mb-12 flex flex-col items-center gap-2">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#00c4cc] shadow-sm">
            <span className="material-symbols-rounded text-[40px] text-[#004c4f]">rocket_launch</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#00696e]">tiklayayinla.com</h1>
        </header>

        <section className="w-full rounded-xl border border-[#bbc9ca]/30 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] sm:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-[#191c1d]">Hoş Geldiniz</h2>
            <p className="mt-2 text-sm text-[#3c494a]">Lütfen hesabınıza giriş yapın.</p>
          </div>

          <LoginForm />

          <div className="mt-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#bbc9ca]/50" />
            <span className="text-[11px] font-semibold tracking-[0.12em] text-[#3c494a]">VEYA</span>
            <div className="h-px flex-1 bg-[#bbc9ca]/50" />
          </div>

          <div className="mt-7 grid grid-cols-2 gap-4">
            <button
              className="relative flex items-center justify-center gap-2 rounded-lg border border-[#bbc9ca] bg-[#f8fafb] py-3 text-sm font-semibold text-[#191c1d] transition disabled:cursor-not-allowed disabled:opacity-60"
              disabled
              type="button"
            >
              <span className="material-symbols-rounded text-[20px]">language</span>
              Google
              <span className="absolute -right-2 -top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Yakında</span>
            </button>
            <button
              className="relative flex items-center justify-center gap-2 rounded-lg border border-[#bbc9ca] bg-[#f8fafb] py-3 text-sm font-semibold text-[#191c1d] transition disabled:cursor-not-allowed disabled:opacity-60"
              disabled
              type="button"
            >
              <span className="material-symbols-rounded text-[20px]">ios</span>
              Apple
              <span className="absolute -right-2 -top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Yakında</span>
            </button>
          </div>
        </section>

        <p className="mt-7 text-center text-sm text-[#3c494a]">
          Hesabınız yok mu?{' '}
          <a className="ml-1 font-bold text-[#00696e] transition hover:underline" href="/register">
            Kayıt Ol
          </a>
        </p>
      </main>

      <footer className="mt-12 text-center text-[11px] font-medium text-[#3c494a]/60">
        © 2026 tiklayayinla.com — Tüm hakları saklıdır.
      </footer>
    </main>
  );
}
