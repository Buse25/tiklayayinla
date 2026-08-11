'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoginForm } from '../../src/components/auth/login-form';

export default function LoginPage() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafb] px-6 py-10 text-[#191c1d] sm:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-2 -top-24 h-96 w-96 rounded-full bg-[#00696e]/5 blur-3xl" />
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
    </GoogleOAuthProvider>
  );
}
