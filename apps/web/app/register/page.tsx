'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Building2, Check, Eye, EyeOff, Lock, Mail, MapPin, Phone, User } from 'lucide-react';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  organizationName: string;
  organizationType: string;
  city: string;
  district: string;
  address: string;
  acceptTerms: boolean;
};

type FieldName = keyof FormData;
type FieldErrors = Partial<Record<FieldName, string>>;

const inputClass = 'w-full rounded-xl border border-gray-200 bg-[#F8FAFB] py-3 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20 disabled:cursor-not-allowed disabled:opacity-60';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function responseErrors(payload: unknown): FieldErrors {
  const messages = Array.isArray((payload as { message?: unknown })?.message)
    ? (payload as { message: string[] }).message
    : [typeof (payload as { message?: unknown })?.message === 'string' ? (payload as { message: string }).message : 'Form alanlarını kontrol edin.'];
  const errors: FieldErrors = {};
  const fields: Array<[string, FieldName]> = [
    ['firstName', 'firstName'], ['lastName', 'lastName'], ['email', 'email'], ['phone', 'phone'], ['password', 'password'],
    ['organization.name', 'organizationName'], ['organization.type', 'organizationType'],
    ['organization.city', 'city'], ['organization.district', 'district'], ['organization.address', 'address'],
  ];
  for (const message of messages) {
    const field = fields.find(([key]) => message.includes(key))?.[1];
    if (field) errors[field] = 'Bu alanı kontrol edin.';
  }
  return errors;
}

function Field({ label, error, icon: Icon, children }: { label: string; error?: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-[#3C494A]">{label}</span>
      <span className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />
        {children}
      </span>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '', password: '', passwordConfirm: '',
    organizationName: '', organizationType: '', city: '', district: '', address: '', acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function update(field: FieldName, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (form.firstName.trim().length < 2 || form.firstName.trim().length > 50) errors.firstName = 'Ad 2-50 karakter olmalıdır.';
    if (form.lastName.trim().length < 2 || form.lastName.trim().length > 50) errors.lastName = 'Soyad 2-50 karakter olmalıdır.';
    if (!emailPattern.test(form.email.trim())) errors.email = 'Geçerli bir e-posta adresi girin.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errors.password = 'Şifre en az 8 karakter, harf ve rakam içermelidir.';
    if (form.password !== form.passwordConfirm) errors.passwordConfirm = 'Şifreler eşleşmiyor.';
    if (form.organizationName.trim().length < 2 || form.organizationName.trim().length > 150) errors.organizationName = 'Firma adı 2-150 karakter olmalıdır.';
    if (!form.organizationType) errors.organizationType = 'Firma türü zorunludur.';
    if (!form.city.trim()) errors.city = 'Şehir zorunludur.';
    if (!form.district.trim()) errors.district = 'İlçe zorunludur.';
    if (!form.address.trim()) errors.address = 'Açık adres zorunludur.';
    if (!form.acceptTerms) setError('Devam etmek için kullanım koşullarını kabul etmelisiniz.');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0 && form.acceptTerms;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase(), phone: optionalValue(form.phone), password: form.password,
          organization: {
            name: form.organizationName.trim(), type: form.organizationType, country: 'Türkiye', city: form.city.trim(), district: form.district.trim(), address: form.address.trim(),
            phone: null, taxNumber: null,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) setError('Bu e-posta adresi zaten kayıtlı.');
        else if (response.status === 422) {
          setFieldErrors(responseErrors(payload));
          setError('Lütfen işaretli alanları kontrol edin.');
        } else setError(typeof payload.message === 'string' ? payload.message : 'Kayıt işlemi tamamlanamadı.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFB] px-4 py-8 text-[#191C1D] sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <Link className="flex items-center gap-2 text-sm font-semibold text-[#00696E] hover:underline" href="/"><ArrowLeft className="h-4 w-4" />Ana sayfaya dön</Link>
          <span className="font-bold text-[#00696E]">tiklayayinla.com</span>
        </header>
        <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="hidden rounded-2xl bg-[#00696E] p-8 text-white lg:block">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Kurumsal ilan yönetimi</span>
            <h1 className="mt-5 text-3xl font-bold leading-tight">Kurumsal Hesabınızı Oluşturun</h1>
            <p className="mt-4 leading-relaxed text-white/80">İlanlarınızı tek panelden yönetin ve yayın süreçlerinizi takip edin.</p>
            <div className="mt-8 space-y-3 text-sm text-white/90">
              {['Tek panelden ilan yönetimi', 'Portal yayın süreçleri', 'Performans ve aktivite takibi'].map((item) => <p className="flex items-center gap-2" key={item}><Check className="h-4 w-4 text-[#00C4CC]" />{item}</p>)}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-bold">Kurumsal Hesabınızı Oluşturun</h1>
              <p className="mt-2 text-sm text-[#3C494A]">İlanlarınızı tek panelden yönetin ve yayın süreçlerinizi takip edin.</p>
            </div>
            {error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            <form className="flex flex-col gap-7" noValidate onSubmit={handleSubmit}>
              <fieldset className="space-y-4"><legend className="mb-4 flex items-center gap-2 text-base font-bold"><User className="h-5 w-5 text-[#00696E]" />Yetkili kişi bilgileri</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field error={fieldErrors.firstName} icon={User} label="Ad"><input className={inputClass} disabled={loading} onChange={(e) => update('firstName', e.target.value)} placeholder="Adınız" value={form.firstName} /></Field>
                  <Field error={fieldErrors.lastName} icon={User} label="Soyad"><input className={inputClass} disabled={loading} onChange={(e) => update('lastName', e.target.value)} placeholder="Soyadınız" value={form.lastName} /></Field>
                </div>
                <Field error={fieldErrors.email} icon={Mail} label="E-posta"><input className={inputClass} disabled={loading} onChange={(e) => update('email', e.target.value)} placeholder="ornek@firma.com" type="email" value={form.email} /></Field>
                <Field error={fieldErrors.phone} icon={Phone} label="Telefon (opsiyonel)"><input className={inputClass} disabled={loading} onChange={(e) => update('phone', e.target.value)} placeholder="+90 555 111 22 33" type="tel" value={form.phone} /></Field>
                <Field error={fieldErrors.password} icon={Lock} label="Şifre"><input className={inputClass} disabled={loading} onChange={(e) => update('password', e.target.value)} placeholder="En az 8 karakter" type={showPassword ? 'text' : 'password'} value={form.password} /><button aria-label="Şifreyi göster veya gizle" className="absolute right-3 top-3 text-gray-400" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></Field>
                <Field error={fieldErrors.passwordConfirm} icon={Lock} label="Şifre tekrar"><input className={inputClass} disabled={loading} onChange={(e) => update('passwordConfirm', e.target.value)} placeholder="Şifrenizi tekrar girin" type={showPasswordConfirm ? 'text' : 'password'} value={form.passwordConfirm} /><button aria-label="Şifre tekrarını göster veya gizle" className="absolute right-3 top-3 text-gray-400" onClick={() => setShowPasswordConfirm((value) => !value)} type="button">{showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></Field>
              </fieldset>
              <fieldset className="border-t border-gray-100 pt-6"><legend className="mb-4 flex items-center gap-2 text-base font-bold"><Building2 className="h-5 w-5 text-[#00696E]" />Kurum bilgileri</legend>
                <div className="space-y-4">
                  <Field error={fieldErrors.organizationName} icon={Building2} label="Firma adı"><input className={inputClass} disabled={loading} onChange={(e) => update('organizationName', e.target.value)} placeholder="Firma adınız" value={form.organizationName} /></Field>
                  <Field error={fieldErrors.organizationType} icon={Building2} label="Firma türü"><select className={inputClass} disabled={loading} onChange={(e) => update('organizationType', e.target.value)} value={form.organizationType}><option value="">Firma türünü seçin</option><option value="REAL_ESTATE_AGENCY">Emlak Ofisi</option><option value="AUTO_DEALER">Galeri / Otomotiv</option><option value="OTHER">Diğer</option></select></Field>
                  <Field error={fieldErrors.city} icon={MapPin} label="Şehir"><input className={inputClass} disabled={loading} onChange={(e) => update('city', e.target.value)} placeholder="Şehir" value={form.city} /></Field>
                  <Field error={fieldErrors.district} icon={MapPin} label="İlçe"><input className={inputClass} disabled={loading} onChange={(e) => update('district', e.target.value)} placeholder="İlçe" value={form.district} /></Field>
                  <Field error={fieldErrors.address} icon={MapPin} label="Açık adres"><textarea className={`${inputClass} min-h-24 py-3`} disabled={loading} onChange={(e) => update('address', e.target.value)} placeholder="Açık adres" value={form.address} /></Field>
                </div>
              </fieldset>
              <label className="flex items-start gap-2.5 text-xs leading-5 text-[#3C494A]"><input checked={form.acceptTerms} className="mt-0.5 h-4 w-4" disabled={loading} onChange={(e) => update('acceptTerms', e.target.checked)} type="checkbox" /><span><a className="font-semibold text-[#00696E] hover:underline" href="/terms">Kullanım Koşullarını</a> ve <a className="font-semibold text-[#00696E] hover:underline" href="/privacy">Gizlilik Politikasını</a> kabul ediyorum.</span></label>
              <button className="w-full rounded-xl bg-[#00C4CC] py-3.5 font-bold text-white shadow-sm transition hover:bg-[#00b0b8] disabled:cursor-not-allowed disabled:opacity-50" disabled={loading} type="submit">{loading ? 'Hesap oluşturuluyor...' : 'Kurumsal Hesap Oluştur'}</button>
            </form>
            <p className="mt-6 text-center text-sm text-[#3C494A]">Zaten hesabınız var mı? <Link className="font-bold text-[#00696E] hover:underline" href="/login">Giriş Yap</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
