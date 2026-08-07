'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '../layout/app-shell';
import { FormEvent, useEffect, useState } from 'react';
import { enumOptions, featureCategories, type FeatureCategory, type Option } from '../../data/listing-form-options';
import { authenticatedFetch } from '../../lib/api-client';
import { getListingTypeLabel } from '../../lib/listing-display-labels';
import { canUsePropertyListings, sectorRestrictionMessage, type OrganizationType } from '../../lib/sector';

type FormData = Record<string, string>;
type FeatureSelections = Record<FeatureCategory['key'], string[]>;

const steps = ['Temel Bilgiler', 'Konum', 'Konut Detayları', 'Özellikler', 'Ön İzleme ve Kaydet'];
const featureKeys = featureCategories.map((category) => category.key) as FeatureCategory['key'][];
const initialFeatures = Object.fromEntries(featureKeys.map((key) => [key, []])) as FeatureSelections;
const detailFields: { key: string; label: string; type: 'number' | 'text' | 'select' | 'boolean'; options?: Option[]; min?: number }[] = [
  { key: 'grossArea', label: 'Brüt alan (m²)', type: 'number', min: 0 }, { key: 'netArea', label: 'Net alan (m²)', type: 'number', min: 0 }, { key: 'roomCount', label: 'Oda sayısı', type: 'text' },
  { key: 'buildingAge', label: 'Bina yaşı', type: 'number', min: 0 }, { key: 'floorNumber', label: 'Bulunduğu kat', type: 'number', min: -10 }, { key: 'totalFloors', label: 'Toplam kat', type: 'number', min: 1 },
  { key: 'heatingType', label: 'Isıtma tipi', type: 'select', options: enumOptions.heatingType }, { key: 'bathroomCount', label: 'Banyo sayısı', type: 'number', min: 0 }, { key: 'kitchenType', label: 'Mutfak tipi', type: 'select', options: enumOptions.kitchenType },
  { key: 'hasBalcony', label: 'Balkon', type: 'boolean' }, { key: 'hasElevator', label: 'Asansör', type: 'boolean' }, { key: 'parkingType', label: 'Otopark', type: 'select', options: enumOptions.parkingType },
  { key: 'isFurnished', label: 'Eşyalı', type: 'boolean' }, { key: 'occupancyStatus', label: 'Kullanım durumu', type: 'select', options: enumOptions.occupancyStatus }, { key: 'isInComplex', label: 'Site içinde', type: 'boolean' },
  { key: 'complexName', label: 'Site adı', type: 'text' }, { key: 'monthlyFee', label: 'Aylık aidat', type: 'number', min: 0 }, { key: 'isCreditEligible', label: 'Krediye uygun', type: 'boolean' },
  { key: 'energyCertificate', label: 'Enerji sertifikası', type: 'select', options: enumOptions.energyCertificate }, { key: 'titleDeedStatus', label: 'Tapu durumu', type: 'select', options: enumOptions.titleDeedStatus },
  { key: 'advertiserType', label: 'İlan veren tipi', type: 'select', options: enumOptions.advertiserType }, { key: 'isExchangeAccepted', label: 'Takas kabulü', type: 'boolean' }, { key: 'housingType', label: 'Konut tipi', type: 'select', options: enumOptions.housingType },
];

function asNumber(value: string): number | undefined { return value.trim() === '' ? undefined : Number(value); }
function omitEmpty(data: FormData, keys: string[]): Record<string, unknown> { return Object.fromEntries(keys.flatMap((key) => data[key]?.trim() ? [[key, data[key].trim()]] : [])); }

export function NewListingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>({ currency: 'TRY', listingType: 'SALE', propertyType: 'APARTMENT' });
  const [features, setFeatures] = useState<FeatureSelections>(initialFeatures);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationType, setOrganizationType] = useState<OrganizationType>(undefined);
  const sectorAllowed = canUsePropertyListings(organizationType);

  function setValue(key: string, value: string) { setData((current) => ({ ...current, [key]: value })); }
  function toggleFeature(key: FeatureCategory['key'], value: string) { setFeatures((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] })); }

  useEffect(() => {
    let active = true;
    void authenticatedFetch('users/me').then(async (response) => {
      if (!response.ok) return;
      const profile = await response.json() as { organizationType?: OrganizationType };
      if (active) setOrganizationType(profile.organizationType ?? null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function validateStep(targetStep: number): string | null {
    if (targetStep === 0) {
      if ((data.title ?? '').trim().length < 5) return 'Başlık en az 5 karakter olmalıdır.';
      if ((data.description ?? '').trim().length < 20) return 'Açıklama en az 20 karakter olmalıdır.';
      if (!asNumber(data.price ?? '') || asNumber(data.price ?? '')! <= 0) return 'Fiyat pozitif bir değer olmalıdır.';
      return null;
    }
    if (targetStep === 1 && (!data.city?.trim() || !data.district?.trim() || !data.address?.trim())) return 'İl, ilçe ve açık adres zorunludur.';
    if (targetStep !== 2) return null;
    const gross = asNumber(data.grossArea ?? ''); const net = asNumber(data.netArea ?? '');
    if (gross !== undefined && gross <= 0) return 'Brüt alan pozitif olmalıdır.';
    if (net !== undefined && net <= 0) return 'Net alan pozitif olmalıdır.';
    if (gross !== undefined && net !== undefined && net > gross) return 'Net alan brüt alandan büyük olamaz.';
    return null;
  }

  function nextStep() { const message = validateStep(step); if (message) return setError(message); setError(null); setStep((current) => Math.min(current + 1, steps.length - 1)); }

  function buildPayload() {
    const residentialDetails: Record<string, unknown> = {};
    for (const field of detailFields) {
      const value = data[field.key];
      if (value === undefined || value === '') continue;
      if (field.type === 'number') residentialDetails[field.key] = Number(value);
      else if (field.type === 'boolean') residentialDetails[field.key] = value === 'true';
      else residentialDetails[field.key] = value;
    }
    if (data.isInComplex !== 'true') delete residentialDetails.complexName;
    return {
      title: data.title.trim(), description: data.description.trim(), price: Number(data.price), currency: data.currency, listingType: data.listingType, propertyType: data.propertyType,
      city: data.city.trim(), district: data.district.trim(), ...omitEmpty(data, ['neighborhood', 'address']),
      ...(asNumber(data.latitude ?? '') !== undefined && { latitude: asNumber(data.latitude ?? '') }), ...(asNumber(data.longitude ?? '') !== undefined && { longitude: asNumber(data.longitude ?? '') }),
      residentialDetails, ...features,
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sectorAllowed) {
      setError(sectorRestrictionMessage(organizationType));
      return;
    }
    const firstInvalidStep = [0, 1, 2].find((targetStep) => validateStep(targetStep));
    if (firstInvalidStep !== undefined) { setError(validateStep(firstInvalidStep)); setStep(firstInvalidStep); return; }
    setError(null); setIsSubmitting(true);
    try {
      const response = await authenticatedFetch('listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()) });
      if (!response.ok) {
        const messages: Record<number, string> = { 409: 'İlan oluşturulamadı, mevcut kayıtlarla çakışma var.', 422: 'Form alanlarını kontrol edin.', 500: 'Sunucu hatası oluştu.', 502: 'Sunucu hatası oluştu.' };
        if (response.status !== 401) setError(messages[response.status] ?? 'İlan oluşturulamadı. Lütfen tekrar deneyin.');
        return;
      }
      const listing = await response.json() as { id: string };
      router.push(`/listings/${listing.id}/media`);
    } catch { setError('Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin.'); }
    finally { setIsSubmitting(false); }
  }

  return <AppShell><div className="p-md max-w-[1600px] mx-auto text-slate-900"><form className="mx-auto max-w-5xl" onSubmit={submit}>
    <header className="mb-8 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">YENİ PORTFÖY</p><h1 className="mt-1 text-3xl font-bold">Yeni ilan oluştur</h1><p className="mt-2 text-sm text-slate-600"><span className="text-red-600">*</span> işaretli alanlar zorunludur.</p></div><Link className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200" href="/listings">İlanlarıma dön</Link></header>
    {!sectorAllowed && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{sectorRestrictionMessage(organizationType)}</div>}
    <ol className="mb-8 grid gap-2 sm:grid-cols-5">{steps.map((label, index) => <li className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${index === step ? 'bg-teal-700 text-white' : index < step ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'}`} key={label}>{index + 1}. {label}</li>)}</ol>
    {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      {step === 0 && <div className="grid gap-5"><Field label="İlan başlığı" required value={data.title ?? ''} onChange={(value) => setValue('title', value)} /><TextArea label="Açıklama" required value={data.description ?? ''} onChange={(value) => setValue('description', value)} /><div className="grid gap-5 sm:grid-cols-2"><Field label="Fiyat" required type="number" min="0.01" value={data.price ?? ''} onChange={(value) => setValue('price', value)} /><Select label="Para birimi" required value={data.currency} options={enumOptions.currency} onChange={(value) => setValue('currency', value)} /><Select label="İlan tipi" required value={data.listingType} options={enumOptions.listingType} onChange={(value) => setValue('listingType', value)} /><Select label="Gayrimenkul tipi" required value={data.propertyType} options={enumOptions.propertyType} onChange={(value) => setValue('propertyType', value)} /></div></div>}
      {step === 1 && <div className="grid gap-5 sm:grid-cols-2"><Field label="İl" required value={data.city ?? ''} onChange={(value) => setValue('city', value)} /><Field label="İlçe" required value={data.district ?? ''} onChange={(value) => setValue('district', value)} /><Field label="Mahalle" value={data.neighborhood ?? ''} onChange={(value) => setValue('neighborhood', value)} /><Field label="Açık adres" required value={data.address ?? ''} onChange={(value) => setValue('address', value)} /><Field label="Enlem" type="number" value={data.latitude ?? ''} onChange={(value) => setValue('latitude', value)} /><Field label="Boylam" type="number" value={data.longitude ?? ''} onChange={(value) => setValue('longitude', value)} /></div>}
      {step === 2 && <div className="grid gap-5 sm:grid-cols-2">{detailFields.map((field) => field.key === 'complexName' && data.isInComplex !== 'true' ? null : field.type === 'select' ? <Select key={field.key} label={field.label} value={data[field.key] ?? ''} options={field.options!} onChange={(value) => setValue(field.key, value)} /> : field.type === 'boolean' ? <Select key={field.key} label={field.label} value={data[field.key] ?? ''} options={[{ value: 'true', label: 'Evet' }, { value: 'false', label: 'Hayır' }]} onChange={(value) => setValue(field.key, value)} /> : <Field key={field.key} label={field.label} type={field.type} min={field.min?.toString()} value={data[field.key] ?? ''} onChange={(value) => setValue(field.key, value)} />)}</div>}
      {step === 3 && <div className="space-y-7">{featureCategories.map((category) => <fieldset key={category.key}><legend className="mb-3 text-base font-bold">{category.label}</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{category.options.map((option) => <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm hover:border-teal-400" key={option.value}><input checked={features[category.key].includes(option.value)} onChange={() => toggleFeature(category.key, option.value)} type="checkbox" /><span>{option.label}</span></label>)}</div></fieldset>)}</div>}
      {step === 4 && <div className="space-y-5"><h2 className="text-xl font-bold">Kaydetmeden önce kontrol edin</h2><div className="grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2"><Preview label="Başlık" value={data.title} /><Preview label="Fiyat" value={data.price ? `${data.price} ${data.currency}` : undefined} /><Preview label="Konum" value={[data.district, data.city].filter(Boolean).join(', ')} /><Preview label="İlan tipi" value={getListingTypeLabel(data.listingType)} /></div><p className="text-sm text-slate-600">İlan taslak olarak oluşturulur. Sonraki adımda görseller ekleyebilirsiniz.</p></div>}
    </section>
    <footer className="mt-6 flex items-center justify-between"><button className="rounded-lg px-4 py-3 font-semibold text-slate-700 disabled:opacity-40" disabled={step === 0 || isSubmitting || !sectorAllowed} onClick={() => setStep((current) => current - 1)} type="button">Geri</button>{step < steps.length - 1 ? <button className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50" disabled={!sectorAllowed} onClick={nextStep} type="button">Devam et</button> : <button className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting || !sectorAllowed} type="submit">{isSubmitting ? 'İlan oluşturuluyor...' : 'İlanı oluştur'}</button>}</footer>
  </form></div></AppShell>;
}

function Field({ label, required, type = 'text', value, onChange, min }: { label: string; required?: boolean; type?: string; value: string; onChange: (value: string) => void; min?: string }) { return <label className="grid gap-2 text-sm font-semibold">{label}{required && <span className="ml-1 text-red-600">*</span>}<input className="rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" min={min} onChange={(event) => onChange(event.target.value)} step={type === 'number' ? 'any' : undefined} type={type} value={value} /></label>; }
function TextArea({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-semibold">{label}{required && <span className="ml-1 text-red-600">*</span>}<textarea className="min-h-36 rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" onChange={(event) => onChange(event.target.value)} value={value} /></label>; }
function Select({ label, required, value, options, onChange }: { label: string; required?: boolean; value: string; options: Option[]; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-semibold">{label}{required && <span className="ml-1 text-red-600">*</span>}<select className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" onChange={(event) => onChange(event.target.value)} value={value}><option value="">Seçiniz</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Preview({ label, value }: { label: string; value?: string }) { return <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-medium">{value || 'Belirtilmedi'}</p></div>; }
