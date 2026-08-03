'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthErrorMessage } from './auth-error-message';

type FieldProps = {
  id: string;
  label: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'email' | 'tel' | 'password';
  disabled: boolean;
  trailing?: React.ReactNode;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RegisterField({ id, label, icon, value, onChange, placeholder, type = 'text', disabled, trailing }: FieldProps) {
  return (
    <label className="flex flex-col gap-2" htmlFor={id}>
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3c494a]">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6c7a7a] material-symbols-rounded">{icon}</span>
        <input
          className="w-full rounded-xl border border-[#bbc9ca] bg-white py-3 pl-11 pr-12 text-base text-[#191c1d] outline-none transition placeholder:text-[#6c7a7a] focus:border-[#00c4cc] focus:ring-4 focus:ring-[#00c4cc]/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {trailing}
      </span>
    </label>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!firstName.trim()) return setError('Ad alanı zorunludur.');
    if (!lastName.trim()) return setError('Soyad alanı zorunludur.');
    if (!emailPattern.test(normalizedEmail)) return setError('Lütfen geçerli bir e-posta adresi girin.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError('Şifre en az 8 karakter olmalı ve en az bir harf ile bir rakam içermelidir.');
    }
    if (password !== passwordConfirm) return setError('Şifreler birbiriyle eşleşmiyor.');
    if (!termsAccepted) return setError('Devam etmek için kullanım koşullarını kabul etmelisiniz.');

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Telefon bilgisi gelecekte profil için kullanılacak; mevcut register API'si bu alanı kabul etmiyor.
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, password }),
      });

      if (!response.ok) {
        setError(
          response.status === 409
            ? 'Bu e-posta adresi zaten kayıtlı.'
            : response.status === 422
              ? 'Lütfen form alanlarını kontrol edin.'
              : 'Kayıt işlemi tamamlanamadı.',
        );
        return;
      }

      router.push('/listings');
      router.refresh();
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
      <AuthErrorMessage message={error} />

      <div className="grid gap-6 sm:grid-cols-2">
        <RegisterField disabled={isLoading} icon="person" id="first-name" label="Ad" onChange={setFirstName} placeholder="Adınız" value={firstName} />
        <RegisterField disabled={isLoading} icon="person" id="last-name" label="Soyad" onChange={setLastName} placeholder="Soyadınız" value={lastName} />
      </div>
      <RegisterField disabled={isLoading} icon="mail" id="register-email" label="E-posta" onChange={setEmail} placeholder="ornek@gmail.com" type="email" value={email} />
      <RegisterField disabled={isLoading} icon="call" id="phone" label="Telefon Numarası" onChange={setPhone} placeholder="0 (5xx) xxx xx xx" type="tel" value={phone} />
      <div className="space-y-2">
        <RegisterField
          disabled={isLoading}
          icon="lock"
          id="register-password"
          label="Şifre"
          onChange={setPassword}
          placeholder="••••••••"
          type={showPassword ? 'text' : 'password'}
          value={password}
          trailing={<button aria-label="Şifreyi göster veya gizle" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6c7a7a] hover:text-[#00696e]" onClick={() => setShowPassword((current) => !current)} type="button"><span className="material-symbols-rounded">{showPassword ? 'visibility_off' : 'visibility'}</span></button>}
        />
        <p className="text-[11px] font-medium text-[#6c7a7a]">En az 8 karakter, harf ve rakam içermelidir.</p>
      </div>
      <RegisterField
        disabled={isLoading}
        icon="lock"
        id="register-password-confirm"
        label="Şifre Tekrar"
        onChange={setPasswordConfirm}
        placeholder="••••••••"
        type={showPasswordConfirm ? 'text' : 'password'}
        value={passwordConfirm}
        trailing={<button aria-label="Şifre tekrarını göster veya gizle" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6c7a7a] hover:text-[#00696e]" onClick={() => setShowPasswordConfirm((current) => !current)} type="button"><span className="material-symbols-rounded">{showPasswordConfirm ? 'visibility_off' : 'visibility'}</span></button>}
      />

      <label className="flex cursor-pointer items-start gap-3 py-1 text-sm leading-5 text-[#3c494a]">
        <input checked={termsAccepted} className="mt-0.5 h-5 w-5 rounded border-[#bbc9ca] text-[#00696e] focus:ring-[#00c4cc]" disabled={isLoading} onChange={(event) => setTermsAccepted(event.target.checked)} type="checkbox" />
        <span><a className="font-semibold text-[#00696e] hover:underline" href="/terms">Kullanım Koşullarını</a> ve <a className="font-semibold text-[#00696e] hover:underline" href="/privacy">Gizlilik Politikasını</a> kabul ediyorum.</span>
      </label>

      <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00c4cc] py-4 text-lg font-semibold text-[#004c4f] shadow-sm transition hover:scale-[1.02] hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-70" disabled={isLoading} type="submit">
        {isLoading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#004c4f]/30 border-t-[#004c4f]" />Hesap oluşturuluyor...</> : 'Kayıt Ol'}
      </button>

      <div className="flex flex-col items-center gap-5 py-2">
        <p className="text-sm text-[#3c494a]">Zaten hesabınız var mı? <a className="font-bold text-[#00696e] hover:underline" href="/login">Giriş Yap</a></p>
        <div className="flex w-full items-center gap-4"><span className="h-px flex-1 bg-[#bbc9ca]" /><span className="text-xs font-semibold text-[#6c7a7a]">VEYA</span><span className="h-px flex-1 bg-[#bbc9ca]" /></div>
        <div className="grid w-full grid-cols-2 gap-4">
          <button className="relative flex items-center justify-center gap-2 rounded-xl border border-[#bbc9ca] bg-white py-3 text-sm font-semibold text-[#191c1d] disabled:cursor-not-allowed disabled:opacity-60" disabled type="button"><span className="material-symbols-rounded text-[20px]">language</span>Google<span className="absolute -right-1 -top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Yakında</span></button>
          <button className="relative flex items-center justify-center gap-2 rounded-xl border border-[#bbc9ca] bg-white py-3 text-sm font-semibold text-[#191c1d] disabled:cursor-not-allowed disabled:opacity-60" disabled type="button"><span className="material-symbols-rounded text-[20px]">ios</span>Apple<span className="absolute -right-1 -top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Yakında</span></button>
        </div>
      </div>
    </form>
  );
}
