'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { AuthErrorMessage } from './auth-error-message';
import { saveVerificationContext } from '../../lib/verification-context';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Geçerli bir e-posta adresi girin.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if ((payload as { code?: string }).code === 'EMAIL_NOT_VERIFIED') {
          saveVerificationContext({
            email: normalizedEmail,
            verificationContext: (payload as { verificationContext?: string }).verificationContext,
          });
          router.push('/register/verify-email');
          return;
        }
        setError(
          response.status === 401
            ? 'E-posta adresi veya şifre hatalı.'
            : response.status === 403
              ? 'Hesabınız doğrulanmamış. Doğrulama ekranına yönlendiriliyorsunuz.'
              : response.status === 422
                ? 'Lütfen form alanlarını kontrol edin.'
                : 'Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.',
        );
        return;
      }

      const loginPayload = await response.clone().json().catch(() => ({})) as { user?: { role?: string } };
      router.push(loginPayload.user?.role === 'ADMIN' ? '/admin' : '/listings');
      router.refresh();
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setError('Google ile giriş başarısız oldu.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.message || 'Google ile giriş başarısız oldu.');
        setIsLoading(false);
        return;
      }

      const loginPayload = await response.json().catch(() => ({})) as { user?: { role?: string } };
      router.push(loginPayload.user?.role === 'ADMIN' ? '/admin' : '/listings');
      router.refresh();
    } catch {
      setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      setIsLoading(false);
    }
  }

  function handleGoogleError() {
    setError('Google ile giriş iptal edildi veya başarısız oldu.');
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <AuthErrorMessage message={error} />

        <div className="relative">
          <input
            className="peer w-full rounded-lg border border-[#bbc9ca] bg-[#f2f4f5] px-4 pb-2 pt-6 text-sm text-[#191c1d] outline-none transition placeholder:text-transparent focus:border-[#00c4cc] focus:bg-white focus:ring-4 focus:ring-[#00c4cc]/20"
            disabled={isLoading}
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-posta Adresi"
            type="email"
            value={email}
          />
          <label className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-[#3c494a] transition peer-focus:text-[#00696e]" htmlFor="login-email">
            E-posta Adresi
          </label>
        </div>

        <div className="relative">
          <input
            className="peer w-full rounded-lg border border-[#bbc9ca] bg-[#f2f4f5] px-4 pb-2 pt-6 pr-12 text-sm text-[#191c1d] outline-none transition placeholder:text-transparent focus:border-[#00c4cc] focus:bg-white focus:ring-4 focus:ring-[#00c4cc]/20"
            disabled={isLoading}
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Şifre"
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
          <label className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-[#3c494a] transition peer-focus:text-[#00696e]" htmlFor="login-password">
            Şifre
          </label>
          <button
            aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="absolute right-3 top-4 text-[#3c494a] transition hover:text-[#00696e]"
            disabled={isLoading}
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            <span className="material-symbols-rounded text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#3c494a]">
            <input className="h-4 w-4 rounded border-[#bbc9ca] text-[#00696e] focus:ring-[#00c4cc]" type="checkbox" />
            Beni hatırla
          </label>
          <a className="text-xs font-semibold tracking-wide text-[#00696e] transition hover:underline" href="/forgot-password">
            Şifremi Unuttum
          </a>
        </div>

        <button
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00696e] to-[#00aeb5] py-4 text-lg font-semibold text-white shadow-lg shadow-[#00696e]/20 transition duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Giriş yapılıyor...
            </>
          ) : (
            'Giriş Yap'
          )}
        </button>
      </form>

      <div className="mt-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-[#bbc9ca]/50" />
        <span className="text-[11px] font-semibold tracking-[0.12em] text-[#3c494a]">VEYA</span>
        <div className="h-px flex-1 bg-[#bbc9ca]/50" />
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4">
        <div className="relative w-full">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#bbc9ca] bg-[#f8fafb] py-3 text-sm font-semibold text-[#191c1d] transition hover:bg-[#f2f4f5]"
            disabled={isLoading}
            type="button"
          >
            <span className="material-symbols-rounded text-[20px]">language</span>
            Google
          </button>
          <div className="absolute inset-0 opacity-0 overflow-hidden cursor-pointer [&_iframe]:!w-full [&_iframe]:!h-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              type="standard"
              theme="outline"
              size="large"
              shape="rectangular"
              width="100%"
              containerProps={{
                style: {
                  width: '100%',
                  height: '100%',
                  display: 'block',
                }
              }}
            />
          </div>
        </div>
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
    </div>
  );
}
