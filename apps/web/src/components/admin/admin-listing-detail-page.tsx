'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../layout/app-shell';
import { authenticatedFetch } from '../../lib/api-client';
import { getCanonicalVehicleBrand, getCanonicalVehicleModel, getDistrictsByCity, getHousingTypesForPropertyType, getModelsByBrand, getTurkeyCities, getVehicleBrands } from '@tiklayayinla/shared-types';

type Listing = Record<string, unknown> & { id: string; listingNo: string; status: string; listingDomain?: string; residentialDetails?: Record<string, unknown>; vehicleDetails?: Record<string, unknown>; features?: Record<string, string[]> };

const detailFields = ['grossArea', 'netArea', 'roomCount', 'buildingAge', 'floorNumber', 'totalFloors', 'bathroomCount', 'monthlyFee'];
const detailLabels: Record<string, string> = { grossArea: 'Brüt m²', netArea: 'Net m²', roomCount: 'Oda sayısı', buildingAge: 'Bina yaşı', floorNumber: 'Bulunduğu kat', totalFloors: 'Toplam kat', bathroomCount: 'Banyo sayısı', monthlyFee: 'Aylık aidat' };
const featureKeys = ['facades', 'interiorFeatures', 'exteriorFeatures', 'nearbyPlaces', 'transportation', 'views', 'accessibilityFeatures'];

const fuelTypeOptions = ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'OTHER'];
const transmissionOptions = ['MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC'];
const bodyTypeOptions = ['SEDAN', 'HATCHBACK', 'SUV', 'COUPE', 'STATION_WAGON', 'PICKUP', 'VAN', 'MINIVAN', 'OTHER'];

export function AdminListingDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Listing | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const cities = getTurkeyCities();
  const districts = getDistrictsByCity(String(form.city ?? ''));

  useEffect(() => {
    void authenticatedFetch(`listings/admin/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('İlan bulunamadı.');
        const x = await r.json() as Listing;
        setItem(x);
        setForm({ ...x });
        const vehicleDetails = x.vehicleDetails ?? {};
        const brand = String(vehicleDetails.brand ?? '');
        setDetails(x.listingDomain === 'VEHICLE' ? { ...vehicleDetails, brand: getCanonicalVehicleBrand(brand) ?? brand, model: getCanonicalVehicleModel(brand, String(vehicleDetails.model ?? '')) ?? String(vehicleDetails.model ?? '') } : (x.residentialDetails ?? {}));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'İlan yüklenemedi.'));
  }, [id]);

  useEffect(() => {
    const incoming = item?.features ?? {};
    if (item && item.listingDomain !== 'VEHICLE') {
      setFeatures(Object.fromEntries(featureKeys.map((key) => [key, (incoming[key] ?? []).map((feature) => typeof feature === 'string' ? feature : String((feature as { code?: string }).code ?? '')).filter(Boolean).join(', ')])));
    }
  }, [item]);

  function setValue(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setDetail(key: string, value: unknown) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function changeVehicleBrand(value: string) {
    setDetails((current) => ({ ...current, brand: value, model: '' }));
  }

  async function save() {
    if (!item || !String(form.title ?? '').trim() || !Number.isFinite(Number(form.price))) return;
    setSaving(true);
    setError('');

    let url = `listings/admin/${id}`;
    let payload: Record<string, unknown>;

    if (item.listingDomain === 'VEHICLE') {
      url = `listings/admin/${id}/vehicle`;
      payload = {
        title: String(form.title).trim(),
        description: String(form.description ?? '').trim(),
        price: Number(form.price),
        currency: form.currency,
        listingType: form.listingType,
        city: String(form.city).trim(),
        district: String(form.district).trim(),
        neighborhood: form.neighborhood ? String(form.neighborhood).trim() : null,
        address: String(form.address).trim(),
        brand: String(details.brand ?? '').trim(),
        model: String(details.model ?? '').trim(),
        year: Number(details.year),
        mileage: Number(details.mileage),
        fuelType: details.fuelType,
        transmission: details.transmission,
        bodyType: details.bodyType || null,
        enginePower: details.enginePower ? Number(details.enginePower) : null,
        engineVolume: details.engineVolume ? Number(details.engineVolume) : null,
        color: details.color ? String(details.color).trim() : null,
        damageStatus: details.damageStatus ? String(details.damageStatus).trim() : null,
        hasWarranty: details.hasWarranty === 'true' || details.hasWarranty === true,
      };
    } else {
      payload = {
        ...form,
        title: String(form.title).trim(),
        description: String(form.description ?? '').trim(),
        price: Number(form.price),
        latitude: form.latitude === '' ? undefined : Number(form.latitude),
        longitude: form.longitude === '' ? undefined : Number(form.longitude),
        residentialDetails: details,
        ...Object.fromEntries(featureKeys.map((key) => [key, (features[key] ?? '').split(',').map((value) => value.trim()).filter(Boolean)])),
      };
      delete payload.id;
      delete payload.listingNo;
      delete payload.status;
      delete payload.ownerId;
      delete payload.organizationId;
      delete payload.owner;
      delete payload.organization;
      delete payload.listingDomain;
      delete payload.vehicleDetails;
    }

    const response = await authenticatedFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setError('İlan güncellenemedi.');
    } else {
      const updated = await response.json() as Listing;
      setItem(updated);
      setForm({ ...updated });
      setDetails(updated.listingDomain === 'VEHICLE' ? (updated.vehicleDetails ?? {}) : (updated.residentialDetails ?? {}));
    }
    setSaving(false);
  }

  async function changeStatus(status: string) {
    if (!item || statusSaving || !window.confirm(`İlanı ${status} durumuna almak istediğinize emin misiniz?`)) return;
    setStatusSaving(true);
    setError('');
    const response = await authenticatedFetch(`listings/admin/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) setError('İlan durumu değiştirilemedi.');
    else setItem(await response.json() as Listing);
    setStatusSaving(false);
  }

  async function softDelete() {
    if (!window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) return;
    const response = await authenticatedFetch(`listings/admin/${id}`, { method: 'DELETE' });
    if (!response.ok) setError('İlan silinemedi.');
    else setItem((current) => (current ? { ...current, status: 'DELETED' } : current));
  }

  if (!item && !error) return <AppShell><main className="p-6">Yükleniyor...</main></AppShell>;

  const isVehicle = item?.listingDomain === 'VEHICLE';

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <Link className="text-sm font-semibold text-teal-700" href="/admin/listings">
          ← Tüm ilanlara dön
        </Link>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {item && (
          <section className="mt-6 space-y-6 rounded-2xl border bg-white p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{item.listingNo} · {item.status}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${isVehicle ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
                  {isVehicle ? 'Araç' : 'Gayrimenkul'}
                </span>
              </div>
              <h1 className="mt-1 text-3xl font-bold">İlan düzenle</h1>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Başlık" value={form.title} onChange={(v) => setValue('title', v)} />
              <Field label="Fiyat" type="number" value={form.price} onChange={(v) => setValue('price', v)} />
              <Select label="Para birimi" value={form.currency} options={['TRY', 'USD', 'EUR', 'GBP']} onChange={(v) => setValue('currency', v)} />
              <Select label="İlan tipi" value={form.listingType} options={['SALE', 'RENT', 'DAILY_RENT']} onChange={(v) => setValue('listingType', v)} />
              
              {!isVehicle && (
                <>
                  <Select label="Gayrimenkul tipi" value={form.propertyType} options={['APARTMENT', 'HOUSE', 'VILLA', 'LAND', 'COMMERCIAL', 'OFFICE', 'OTHER']} onChange={(v) => { setValue('propertyType', v); setValue('housingType', ''); }} />
                  <Select label="Konut tipi" value={details.housingType ?? form.housingType} options={getHousingTypesForPropertyType(String(form.propertyType ?? 'OTHER'))} onChange={(v) => setDetails((d) => ({ ...d, housingType: v }))} />
                </>
              )}

              {isVehicle && (
                <>
                  <CatalogSelect label="Marka" value={String(details.brand ?? '')} options={getVehicleBrands()} onChange={changeVehicleBrand} placeholder="Marka seçiniz" />
                  <CatalogSelect label="Model" value={String(details.model ?? '')} options={getModelsByBrand(String(details.brand ?? ''))} onChange={(v) => setDetail('model', v)} disabled={!details.brand} placeholder="Önce marka seçiniz" />
                  <Field label="Model Yılı" type="number" value={details.year} onChange={(v) => setDetail('year', Number(v))} />
                  <Field label="Kilometre" type="number" value={details.mileage} onChange={(v) => setDetail('mileage', Number(v))} />
                </>
              )}
            </div>

            <label className="grid gap-2 text-sm font-semibold">
              Açıklama
              <textarea className="min-h-28 rounded-lg border p-3 font-normal" value={String(form.description ?? '')} onChange={(e) => setValue('description', e.target.value)} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="İl" value={form.city} options={cities.map((c) => c.name)} onChange={(v) => { setValue('city', v); setValue('district', ''); }} />
              <Select label="İlçe" value={form.district} options={districts} onChange={(v) => setValue('district', v)} />
              <Field label="Mahalle" value={form.neighborhood ?? form.neighbourhood} onChange={(v) => setValue('neighborhood', v)} />
              <Field label="Adres" value={form.address} onChange={(v) => setValue('address', v)} />
              
              {!isVehicle && (
                <>
                  <Field label="Enlem" type="number" value={form.latitude} onChange={(v) => setValue('latitude', v)} />
                  <Field label="Boylam" type="number" value={form.longitude} onChange={(v) => setValue('longitude', v)} />
                </>
              )}
            </div>

            {isVehicle && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Yakıt Tipi" value={details.fuelType} options={fuelTypeOptions} onChange={(v) => setDetail('fuelType', v)} />
                <Select label="Vites Tipi" value={details.transmission} options={transmissionOptions} onChange={(v) => setDetail('transmission', v)} />
                <Select label="Kasa Tipi" value={details.bodyType} options={bodyTypeOptions} onChange={(v) => setDetail('bodyType', v)} />
                <Field label="Motor Gücü" type="number" value={details.enginePower} onChange={(v) => setDetail('enginePower', v ? Number(v) : undefined)} />
                <Field label="Motor Hacmi" type="number" value={details.engineVolume} onChange={(v) => setDetail('engineVolume', v ? Number(v) : undefined)} />
                <Field label="Renk" value={details.color} onChange={(v) => setDetail('color', v)} />
                <Field label="Hasar Durumu" value={details.damageStatus} onChange={(v) => setDetail('damageStatus', v)} />
                <Select label="Garanti" value={String(details.hasWarranty ?? '')} options={['true', 'false']} onChange={(v) => setDetail('hasWarranty', v === 'true')} />
              </div>
            )}

            {!isVehicle && (
              <div className="grid gap-4 sm:grid-cols-2">
                {detailFields.map((key) => (
                  <Field key={key} label={detailLabels[key]} type="number" value={details[key]} onChange={(v) => setDetail(key, v === '' ? undefined : Number(v))} />
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button disabled={saving} onClick={() => void save()} className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white">
                {saving ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}
              </button>
              {item.status === 'ACTIVE' && (
                <button onClick={() => void changeStatus('SUSPENDED')} className="rounded-xl border px-5 py-3 font-semibold">
                  Askıya al
                </button>
              )}
              {item.status === 'SUSPENDED' && (
                <button onClick={() => void changeStatus('ACTIVE')} className="rounded-xl border px-5 py-3 font-semibold">
                  Aktif et
                </button>
              )}
              {['ACTIVE', 'SUSPENDED'].includes(item.status) && (
                <button onClick={() => void changeStatus('DRAFT')} className="rounded-xl border px-5 py-3 font-semibold">
                  Taslağa çek
                </button>
              )}
              {item.status === 'DRAFT' && (
                <button onClick={() => void changeStatus('ACTIVE')} className="rounded-xl border px-5 py-3 font-semibold">
                  Yayınla
                </button>
              )}
              {item.status !== 'DELETED' && (
                <button onClick={() => void softDelete()} className="rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-700">
                  Sil
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: unknown; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input className="rounded-lg border p-3 font-normal" type={type} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: unknown; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <select className="rounded-lg border p-3 font-normal" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">Seçiniz</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CatalogSelect({ label, value, options, onChange, disabled, placeholder }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean; placeholder: string }) {
  return <label className="grid gap-2 text-sm font-semibold">
    {label}
    <select className="rounded-lg border p-3 font-normal disabled:bg-slate-100" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}
