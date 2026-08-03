'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Check, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 1) return numbers ? '0 ' : '';
    if (numbers.length <= 4) return `0 (${numbers.slice(1, 4)}`;
    if (numbers.length <= 7) return `0 (${numbers.slice(1, 4)}) ${numbers.slice(4, 7)}`;
    if (numbers.length <= 9) return `0 (${numbers.slice(1, 4)}) ${numbers.slice(4, 7)} ${numbers.slice(7, 9)}`;
    return `0 (${numbers.slice(1, 4)}) ${numbers.slice(4, 7)} ${numbers.slice(7, 9)} ${numbers.slice(9, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData((prev) => ({ ...prev, phone: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.acceptTerms) {
      setError('Kayıt olabilmek için kullanım koşullarını kabul etmelisiniz.');
      return;
    }

    const nameParts = formData.fullName.trim().split(/\s+/);
    const firstName = nameParts.shift() ?? '';
    const lastName = nameParts.join(' ');

    if (!firstName || !lastName) {
      setError('Lütfen adınızı ve soyadınızı girin.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Kayıt işlemi başarısız.');

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-[#191C1D] flex flex-col justify-between">
      {/* Header */}
      <header className="w-full h-16 px-4 md:px-8 flex items-center justify-between bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#191C1D]" />
          </Link>
          <h1 className="text-xl font-bold text-[#00696E]">Hesap Oluştur</h1>
        </div>
        <div className="text-[#00C4CC] font-bold text-lg hidden sm:block">
          tiklayayinla.com
        </div>
      </header>

      {/* Main Container - Responsive Layout */}
      <main className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col md:flex-row items-center gap-12 justify-center">
        {/* Desktop Left Info Banner (Hidden on Mobile) */}
        <div className="hidden md:flex flex-1 flex-col gap-6 max-w-lg">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#00C4CC]/10 text-[#00696E]">
            Emlak Portföy Platformu
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-[#191C1D] leading-tight">
            Gayrimenkul Portföyünüzü Tek Bir Yerden Profesyonelce Yönetin
          </h2>
          <p className="text-[#3C494A] leading-relaxed">
            Binlerce emlak danışmanı ve gayrimenkul firmasının tercihi tiklayayinla.com ağında ilanlarınızı anında yayınlayın, CRM entegrasyonu ile portföyünüzü büyütün.
          </p>
          <div className="space-y-3 pt-2">
            {[
              'Sınırsız İlan & Portföy Yönetimi',
              'Otomatik Web & Mobil Eşleşme',
              'Müşteri İlişkileri (CRM) Araçları',
              '7/24 Teknik Destek & Danışmanlık'
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#00C4CC]/20 flex items-center justify-center text-[#00696E]">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <span className="text-sm font-medium text-[#191C1D]">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Box (Center on Mobile, Right on Desktop) */}
        <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-[#191C1D]">
              Gayrimenkul Portföyünüzü Yönetmeye Başlayın
            </h2>
            <p className="text-sm text-[#3C494A]">
              Profesyonel emlak ağına katılmak için formu doldurarak kayıt işleminizi tamamlayın.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg">Hesabınız Başarıyla Oluşturuldu!</h3>
              <p className="text-sm">E-posta adresinize gönderilen doğrulama bağlantısına tıklayarak giriş yapabilirsiniz.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Ad Soyad */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#3C494A] uppercase tracking-wider">
                  AD SOYAD
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Adınız ve Soyadınız"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full bg-[#F8FAFB] border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20 transition-all"
                  />
                </div>
              </div>

              {/* E-posta */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#3C494A] uppercase tracking-wider">
                  E-POSTA
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="example@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#F8FAFB] border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20 transition-all"
                  />
                </div>
              </div>

              {/* Telefon Numarası */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#3C494A] uppercase tracking-wider">
                  TELEFON NUMARASI
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    required
                    placeholder="0 (5xx) xxx xx xx"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className="w-full bg-[#F8FAFB] border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20 transition-all"
                  />
                </div>
              </div>

              {/* Şifre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#3C494A] uppercase tracking-wider">
                  ŞİFRE
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#F8FAFB] border border-gray-200 rounded-xl py-3 pl-11 pr-11 text-sm focus:outline-none focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">En az 8 karakter, harf ve rakam içermelidir.</p>
              </div>

              {/* Onay Checkbox */}
              <div className="flex items-start gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.acceptTerms}
                  onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#00C4CC] focus:ring-[#00C4CC]"
                />
                <label htmlFor="terms" className="text-xs text-[#3C494A] leading-tight cursor-pointer">
                  <span className="font-semibold text-[#00696E] hover:underline">Kullanım Koşullarını</span> ve{' '}
                  <span className="font-semibold text-[#00696E] hover:underline">Gizlilik Politikasını</span> kabul ediyorum.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#00C4CC] hover:bg-[#00b0b8] text-white font-bold rounded-xl shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Kayıt Yapılıyor...' : 'Kayıt Ol'}
              </button>
            </form>
          )}

          {/* Login Link */}
          <div className="flex flex-col items-center gap-4 text-xs text-[#3C494A]">
            <p>
              Zaten hesabınız var mı?{' '}
              <Link href="/login" className="font-bold text-[#00696E] hover:underline">
                Giriş Yap
              </Link>
            </p>

            <div className="w-full flex items-center gap-3">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase">VEYA</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            {/* Social Logins */}
            <div className="w-full flex gap-3">
              <button className="flex-1 py-2.5 border border-gray-200 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors font-medium text-xs">
                <span>Google</span>
              </button>
              <button className="flex-1 py-2.5 border border-gray-200 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors font-medium text-xs">
                <span>Apple</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
