import { ForgotPasswordForm } from '../../src/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-6"><section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"><h1 className="text-2xl font-bold text-slate-900">Şifremi unuttum</h1><p className="mt-2 text-sm text-slate-600">E-posta adresinize gelen 6 haneli kodla yeni şifrenizi oluşturun.</p><ForgotPasswordForm /></section></main>;
}
