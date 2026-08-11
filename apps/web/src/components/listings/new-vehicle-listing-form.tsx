'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AppShell } from '../layout/app-shell';
import { authenticatedFetch } from '../../lib/api-client';
import { getListingTypeLabel } from '../../lib/listing-display-labels';
import { type OrganizationType } from '../../lib/sector';
import { getCanonicalVehicleBrand, getCanonicalVehicleModel, getDistrictsByCity, getModelsByBrand, getTurkeyCities, getVehicleBrands, isValidVehicleBrandModel } from '@tiklayayinla/shared-types';

type FormData = Record<string, string>;

const steps = ['Temel ve Araç Bilgileri', 'Konum', 'Teknik Detaylar', 'Araç Durumu', 'Ön İzleme ve Kaydet'];

const fuelTypeOptions = [
  { value: 'GASOLINE', label: 'Benzin' },
  { value: 'DIESEL', label: 'Dizel' },
  { value: 'HYBRID', label: 'Hibrit' },
  { value: 'ELECTRIC', label: 'Elektrik' },
  { value: 'LPG', label: 'LPG' },
  { value: 'OTHER', label: 'Diğer' },
];

const transmissionOptions = [
  { value: 'MANUAL', label: 'Manuel' },
  { value: 'AUTOMATIC', label: 'Otomatik' },
  { value: 'SEMI_AUTOMATIC', label: 'Yarı Otomatik' },
];

const bodyTypeOptions = [
  { value: 'SEDAN', label: 'Sedan' },
  { value: 'HATCHBACK', label: 'Hatchback' },
  { value: 'SUV', label: 'SUV' },
  { value: 'COUPE', label: 'Coupe' },
  { value: 'STATION_WAGON', label: 'Station Wagon' },
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINIVAN', label: 'Minivan' },
  { value: 'OTHER', label: 'Diğer' },
];

const currencyOptions = [
  { value: 'TRY', label: 'TL' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

const listingTypeOptions = [
  { value: 'SALE', label: 'Satılık' },
  { value: 'RENT', label: 'Kiralık' },
];

interface ProfileData {
  organizationType?: OrganizationType;
  organization?: {
    city?: string | null;
    district?: string | null;
    address?: string | null;
  } | null;
}

export function NewVehicleListingForm({ initialProfile }: { initialProfile: ProfileData | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const org = initialProfile?.organization;
  const initialLocation = normalizeProfileLocation(org?.city, org?.district);
  const hasMissingAddress = !org?.address;

  const [data, setData] = useState<FormData>({
    currency: 'TRY',
    listingType: 'SALE',
    fuelType: 'GASOLINE',
    transmission: 'MANUAL',
    city: initialLocation.city,
    district: initialLocation.district,
    address: org?.address || '',
  });

  function setValue(key: string, value: string) {
    setData((current) => ({ ...current, [key]: value }));
  }

  function changeBrand(value: string) {
    setData((current) => ({ ...current, brand: value, model: '' }));
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep === 0) {
      if ((data.title ?? '').trim().length < 5) return 'Başlık en az 5 karakter olmalıdır.';
      if ((data.description ?? '').trim().length < 20) return 'Açıklama en az 20 karakter olmalıdır.';
      
      const priceVal = Number(data.price);
      if (Number.isNaN(priceVal) || priceVal <= 0) return 'Fiyat pozitif bir değer olmalıdır.';
      
      if (!(data.brand ?? '').trim()) return 'Marka girilmesi zorunludur.';
      if (!(data.model ?? '').trim()) return 'Model girilmesi zorunludur.';
      if (!isValidVehicleBrandModel(data.brand, data.model)) return 'Seçilen marka ve model eşleşmesi geçersizdir.';
      
      const yearVal = Number(data.year);
      if (Number.isNaN(yearVal) || yearVal < 1900 || yearVal > 2027) return 'Lütfen geçerli bir araç model yılı girin (1900 - 2027).';
      
      const mileageVal = Number(data.mileage);
      if (Number.isNaN(mileageVal) || mileageVal < 0) return 'Kilometre negatif olamaz.';
      
      return null;
    }
    
    if (targetStep === 1) {
      if (!data.city?.trim() || !data.district?.trim() || !data.address?.trim()) {
        return 'Kurum il, ilçe ve açık adresi zorunludur. Profil ayarlarınızdan eksikse güncelleyin.';
      }
      return null;
    }

    if (targetStep === 2) {
      if (data.enginePower !== undefined && data.enginePower !== '') {
        const val = Number(data.enginePower);
        if (Number.isNaN(val) || val < 0) return 'Motor gücü negatif olamaz.';
      }
      if (data.engineVolume !== undefined && data.engineVolume !== '') {
        const val = Number(data.engineVolume);
        if (Number.isNaN(val) || val < 0) return 'Motor hacmi negatif olamaz.';
      }
      return null;
    }

    return null;
  }

  function nextStep() {
    const message = validateStep(step);
    if (message) return setError(message);
    setError(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function buildPayload() {
    return {
      title: data.title.trim(),
      description: data.description.trim(),
      price: Number(data.price),
      currency: data.currency,
      listingType: data.listingType,
      brand: getCanonicalVehicleBrand(data.brand) ?? data.brand.trim(),
      model: getCanonicalVehicleModel(data.brand, data.model) ?? data.model.trim(),
      year: Number(data.year),
      mileage: Number(data.mileage),
      fuelType: data.fuelType,
      transmission: data.transmission,
      ...(data.bodyType && { bodyType: data.bodyType }),
      ...(data.enginePower && { enginePower: Number(data.enginePower) }),
      ...(data.engineVolume && { engineVolume: Number(data.engineVolume) }),
      ...(data.color?.trim() && { color: data.color.trim() }),
      ...(data.damageStatus?.trim() && { damageStatus: data.damageStatus.trim() }),
      ...(data.hasWarranty && { hasWarranty: data.hasWarranty === 'true' }),
      city: data.city.trim(),
      district: data.district.trim(),
      ...(data.neighborhood?.trim() && { neighborhood: data.neighborhood.trim() }),
      address: data.address.trim(),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const firstInvalidStep = [0, 1, 2].find((targetStep) => validateStep(targetStep));
    if (firstInvalidStep !== undefined) {
      setError(validateStep(firstInvalidStep));
      setStep(firstInvalidStep);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authenticatedFetch('listings/vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!response.ok) {
        if (response.status === 422) setError('Form alanlarını kontrol edin.');
        else setError('İlan oluşturulamadı. Lütfen tekrar deneyin.');
        return;
      }
      const listing = await response.json() as { id: string };
      router.push(`/listings/${listing.id}/media`);
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasMissingAddress) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl p-6 text-slate-900">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800">Yeni Araç İlanı Oluştur</h1>
            <p className="mt-2 text-sm text-slate-600">Galerici üyeliği ile ilan girişi.</p>
          </header>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-950 shadow-sm">
            <h2 className="text-lg font-bold">Kurum Bilgileri Eksik!</h2>
            <p className="mt-3 text-sm">
              İlan oluşturabilmek için kurum adres bilgilerinizi (il, ilçe, açık adres) tamamlamanız gerekiyor.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Link className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800" href="/profile">
                Profilimi Güncelle
              </Link>
              <Link className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700" href="/listings">
                İlanlarıma Dön
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-md max-w-[1600px] mx-auto text-slate-900">
        <form className="mx-auto max-w-5xl" onSubmit={submit}>
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-700">YENİ GALERİ PORTFÖYÜ</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-800">Yeni Araç İlanı Oluştur</h1>
              <p className="mt-2 text-sm text-slate-600"><span className="text-red-600">*</span> işaretli alanlar zorunludur.</p>
            </div>
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200" href="/listings">
              İlanlarıma dön
            </Link>
          </header>

          <ol className="mb-8 grid gap-2 sm:grid-cols-5">
            {steps.map((label, index) => (
              <li
                className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${
                  index === step ? 'bg-teal-700 text-white' : index < step ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
                }`}
                key={label}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 animate-pulse" role="alert">
              {error}
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            {step === 0 && (
              <div className="grid gap-5">
                <Field label="İlan başlığı" required value={data.title ?? ''} onChange={(value) => setValue('title', value)} />
                <TextArea label="Açıklama" required value={data.description ?? ''} onChange={(value) => setValue('description', value)} />
                
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Fiyat" required type="number" min="0.01" value={data.price ?? ''} onChange={(value) => setValue('price', value)} />
                  <Select label="Para birimi" required value={data.currency} options={currencyOptions} onChange={(value) => setValue('currency', value)} />
                  <Select label="İlan tipi" required value={data.listingType} options={listingTypeOptions} onChange={(value) => setValue('listingType', value)} />
                  
                  <CatalogSelect label="Marka" required value={data.brand ?? ''} options={getVehicleBrands()} onChange={changeBrand} placeholder="Marka seçiniz" />
                  <CatalogSelect label="Model" required value={data.model ?? ''} options={getModelsByBrand(data.brand ?? '')} onChange={(value) => setValue('model', value)} disabled={!data.brand} placeholder="Önce marka seçiniz" />
                  <Field label="Model Yılı" required type="number" min="1900" max="2027" value={data.year ?? ''} onChange={(value) => setValue('year', value)} />
                  <Field label="Kilometre" required type="number" min="0" value={data.mileage ?? ''} onChange={(value) => setValue('mileage', value)} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <LocationFields
                  city={data.city ?? ''}
                  district={data.district ?? ''}
                  onCityChange={(value) => setData((current) => ({ ...current, city: value, district: '' }))}
                  onDistrictChange={(value) => setValue('district', value)}
                />

                <Field label="Mahalle (İsteğe bağlı)" value={data.neighborhood ?? ''} onChange={(value) => setValue('neighborhood', value)} />
                
                <div className="sm:col-span-2">
                  <Field label="Açık adres" required value={data.address ?? ''} onChange={(value) => setValue('address', value)} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Select label="Yakıt Tipi" required value={data.fuelType} options={fuelTypeOptions} onChange={(value) => setValue('fuelType', value)} />
                <Select label="Vites Tipi" required value={data.transmission} options={transmissionOptions} onChange={(value) => setValue('transmission', value)} />
                <Select label="Kasa Tipi (İsteğe bağlı)" value={data.bodyType ?? ''} options={bodyTypeOptions} onChange={(value) => setValue('bodyType', value)} />
                <Field label="Motor Gücü (HP - İsteğe bağlı)" type="number" min="0" value={data.enginePower ?? ''} onChange={(value) => setValue('enginePower', value)} />
                <Field label="Motor Hacmi (CC - İsteğe bağlı)" type="number" min="0" value={data.engineVolume ?? ''} onChange={(value) => setValue('engineVolume', value)} />
                <Field label="Renk (İsteğe bağlı)" value={data.color ?? ''} onChange={(value) => setValue('color', value)} />
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-5">
                <TextArea label="Boya / Değişen / Hasar Durumu (İsteğe bağlı)" value={data.damageStatus ?? ''} onChange={(value) => setValue('damageStatus', value)} />
                <Select
                  label="Garanti var mı?"
                  value={data.hasWarranty ?? ''}
                  options={[
                    { value: 'true', label: 'Evet' },
                    { value: 'false', label: 'Hayır' },
                  ]}
                  onChange={(value) => setValue('hasWarranty', value)}
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-slate-800">Kaydetmeden önce kontrol edin</h2>
                <div className="grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
                  <Preview label="İlan Başlığı" value={data.title} />
                  <Preview label="Marka / Model" value={`${data.brand} ${data.model} (${data.year})`} />
                  <Preview label="Kilometre" value={data.mileage ? `${Number(data.mileage).toLocaleString('tr-TR')} km` : undefined} />
                  <Preview label="Fiyat" value={data.price ? `${Number(data.price).toLocaleString('tr-TR')} ${data.currency}` : undefined} />
                  <Preview label="İlan Tipi" value={getListingTypeLabel(data.listingType)} />
                  <Preview label="Yakıt / Vites" value={`${fuelTypeOptions.find(f => f.value === data.fuelType)?.label} / ${transmissionOptions.find(t => t.value === data.transmission)?.label}`} />
                  <Preview label="Konum" value={[data.district, data.city].filter(Boolean).join(', ')} />
                  <Preview label="Açık Adres" value={data.address} />
                </div>
                <p className="text-sm text-slate-600">İlan taslak olarak oluşturulacaktır. Sonraki adımda görseller ekleyebilirsiniz.</p>
              </div>
            )}
          </section>

          <footer className="mt-6 flex items-center justify-between">
            <button
              className="rounded-lg px-4 py-3 font-semibold text-slate-700 disabled:opacity-40"
              disabled={step === 0 || isSubmitting}
              onClick={() => setStep((current) => current - 1)}
              type="button"
            >
              Geri
            </button>
            {step < steps.length - 1 ? (
              <button className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800" onClick={nextStep} type="button">
                Devam et
              </button>
            ) : (
              <button
                className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'İlan oluşturuluyor...' : 'İlanı oluştur'}
              </button>
            )}
          </footer>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  required,
  type = 'text',
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      {required && <span className="ml-1 text-red-600">*</span>}
      <input
        className="rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        min={min}
        max={max}
        onChange={(event) =>
          onChange(
            type === 'number'
              ? event.target.value.replace(Number(min) < 0 ? /[^0-9.,-]/g : /[^0-9.,]/g, '').replace(',', '.')
              : event.target.value
          )
        }
        step={type === 'number' ? 'any' : undefined}
        inputMode={type === 'number' ? 'decimal' : undefined}
        type={type === 'number' ? 'text' : type}
        value={value}
      />
    </label>
  );
}

function TextArea({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      {required && <span className="ml-1 text-red-600">*</span>}
      <textarea
        className="min-h-36 rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function Select({
  label,
  required,
  value,
  options,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      {required && <span className="ml-1 text-red-600">*</span>}
      <select
        className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Seçiniz</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CatalogSelect({ label, required, value, options, onChange, disabled, placeholder }: { label: string; required?: boolean; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean; placeholder: string }) {
  return <label className="grid gap-2 text-sm font-semibold">
    {label}{required && <span className="ml-1 text-red-600">*</span>}
    <select className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" disabled={disabled} required={required} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

function Preview({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-medium">{value || 'Belirtilmedi'}</p>
    </div>
  );
}

function normalizeProfileLocation(city?: string | null, district?: string | null): { city: string; district: string } {
  const cities = getTurkeyCities();
  const cityValue = city?.trim() ?? '';
  const canonicalCity = cities.find((item) => item.name.localeCompare(cityValue, 'tr-TR', { sensitivity: 'base' }) === 0)
    ?? cities.find((item) => `${item.name} Merkez`.localeCompare(cityValue, 'tr-TR', { sensitivity: 'base' }) === 0);
  if (!canonicalCity) return { city: '', district: '' };
  const districts = getDistrictsByCity(canonicalCity.name);
  const districtValue = district?.trim() ?? '';
  const canonicalDistrict = districts.find((item) => item.localeCompare(districtValue, 'tr-TR', { sensitivity: 'base' }) === 0)
    ?? districts.find((item) => item.localeCompare(canonicalCity.name, 'tr-TR', { sensitivity: 'base' }) === 0)
    ?? (districtValue.toLocaleLowerCase('tr-TR').endsWith(' merkez') ? districts.find((item) => item === 'Merkez') : undefined);
  return { city: canonicalCity.name, district: canonicalDistrict ?? '' };
}

function LocationFields({ city, district, onCityChange, onDistrictChange }: { city: string; district: string; onCityChange: (value: string) => void; onDistrictChange: (value: string) => void }) {
  const cities = getTurkeyCities();
  const districts = getDistrictsByCity(city);
  return <>
    <label className="grid gap-2 text-sm font-semibold">İl<span className="text-red-600">*</span><select className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" required value={city} onChange={(event) => onCityChange(event.target.value)}><option value="">İl seçiniz</option>{cities.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}</select></label>
    <label className="grid gap-2 text-sm font-semibold">İlçe<span className="text-red-600">*</span><select className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" disabled={!city} required value={district} onChange={(event) => onDistrictChange(event.target.value)}><option value="">{city ? 'İlçe seçiniz' : 'Önce il seçiniz'}</option>{districts.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
  </>;
}
