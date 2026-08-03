'use client';

type AuthInputProps = { label: string; icon: string; value: string; onChange: (value: string) => void; type?: 'text' | 'email' | 'tel'; placeholder: string; autoComplete?: string; disabled?: boolean };

export function AuthInput({ label, icon, value, onChange, type = 'text', placeholder, autoComplete, disabled }: AuthInputProps) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><span className="relative block"><span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-slate-400 material-symbols-rounded">{icon}</span><input value={value} onChange={event => onChange(event.target.value)} disabled={disabled} type={type} autoComplete={autoComplete} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60" /></span></label>;
}
