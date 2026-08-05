import { enumOptions } from '../../data/listing-form-options';
import type { ColumnMapping, ListingImportField } from './types';

export const importFields: ListingImportField[] = [
  { key: 'externalId', label: 'Harici ID', type: 'string', group: 'Referans' },
  { key: 'referenceNo', label: 'Referans No', type: 'string', group: 'Referans' },
  { key: 'title', label: 'Başlık', required: true, type: 'string', group: 'Temel' },
  { key: 'description', label: 'Açıklama', required: true, type: 'string', group: 'Temel' },
  { key: 'price', label: 'Fiyat', required: true, type: 'number', group: 'Temel' },
  { key: 'currency', label: 'Para Birimi', required: true, type: 'enum', options: enumOptions.currency, group: 'Temel' },
  { key: 'listingType', label: 'İlan Tipi', required: true, type: 'enum', options: enumOptions.listingType, group: 'Temel' },
  { key: 'propertyType', label: 'Gayrimenkul Tipi', required: true, type: 'enum', options: enumOptions.propertyType, group: 'Temel' },
  { key: 'city', label: 'Şehir', required: true, type: 'string', group: 'Konum' },
  { key: 'district', label: 'İlçe', required: true, type: 'string', group: 'Konum' },
  { key: 'neighborhood', label: 'Mahalle', type: 'string', group: 'Konum' },
  { key: 'address', label: 'Açık Adres', required: true, type: 'string', group: 'Konum' },
  { key: 'grossArea', label: 'Brüt Alan', type: 'number', group: 'Konut Detayı' },
  { key: 'netArea', label: 'Net Alan', type: 'number', group: 'Konut Detayı' },
  { key: 'roomCount', label: 'Oda Sayısı', type: 'string', group: 'Konut Detayı' },
  { key: 'buildingAge', label: 'Bina Yaşı', type: 'number', group: 'Konut Detayı' },
  { key: 'floorNumber', label: 'Bulunduğu Kat', type: 'number', group: 'Konut Detayı' },
  { key: 'totalFloors', label: 'Kat Sayısı', type: 'number', group: 'Konut Detayı' },
  { key: 'heatingType', label: 'Isıtma Tipi', type: 'enum', options: enumOptions.heatingType, group: 'Konut Detayı' },
  { key: 'bathroomCount', label: 'Banyo Sayısı', type: 'number', group: 'Konut Detayı' },
  { key: 'kitchenType', label: 'Mutfak Tipi', type: 'enum', options: enumOptions.kitchenType, group: 'Konut Detayı' },
  { key: 'hasBalcony', label: 'Balkon', type: 'boolean', group: 'Konut Detayı' },
  { key: 'hasElevator', label: 'Asansör', type: 'boolean', group: 'Konut Detayı' },
  { key: 'parkingType', label: 'Otopark', type: 'enum', options: enumOptions.parkingType, group: 'Konut Detayı' },
  { key: 'isFurnished', label: 'Eşyalı', type: 'boolean', group: 'Konut Detayı' },
  { key: 'occupancyStatus', label: 'Kullanım Durumu', type: 'enum', options: enumOptions.occupancyStatus, group: 'Konut Detayı' },
  { key: 'isInComplex', label: 'Site İçerisinde', type: 'boolean', group: 'Konut Detayı' },
  { key: 'complexName', label: 'Site Adı', type: 'string', group: 'Konut Detayı' },
  { key: 'monthlyFee', label: 'Aidat', type: 'number', group: 'Konut Detayı' },
  { key: 'isCreditEligible', label: 'Krediye Uygun', type: 'boolean', group: 'Konut Detayı' },
  { key: 'energyCertificate', label: 'Enerji Sınıfı', type: 'enum', options: enumOptions.energyCertificate, group: 'Konut Detayı' },
  { key: 'titleDeedStatus', label: 'Tapu Durumu', type: 'enum', options: enumOptions.titleDeedStatus, group: 'Konut Detayı' },
  { key: 'advertiserType', label: 'İlan Sahibi Türü', type: 'enum', options: enumOptions.advertiserType, group: 'Konut Detayı' },
  { key: 'isExchangeAccepted', label: 'Takasa Uygun', type: 'boolean', group: 'Konut Detayı' },
  { key: 'housingType', label: 'Konut Tipi', type: 'enum', options: enumOptions.housingType, group: 'Konut Detayı' },
];

const synonyms: Record<string, string[]> = {
  externalId: ['externalid', 'hariciid', 'id'],
  referenceNo: ['referansno', 'referans', 'ilannumarasi', 'listingno', 'referenceno', 'reference'],
  title: ['baslik', 'başlık', 'title', 'ilanbasligi'],
  description: ['aciklama', 'açıklama', 'description', 'detay'],
  price: ['fiyat', 'price', 'tutar'],
  currency: ['parabirimi', 'currency', 'doviz', 'döviz'],
  listingType: ['ilantipi', 'listingtype', 'satilikkiralik', 'satılık/kiralık'],
  propertyType: ['gayrimenkultipi', 'propertytype', 'kategori', 'category', 'emlaktipi'],
  city: ['sehir', 'şehir', 'il', 'city'],
  district: ['ilce', 'ilçe', 'district'],
  neighborhood: ['mahalle', 'neighborhood'],
  address: ['adres', 'acikadres', 'açıkadres', 'address'],
};

function compact(value: string) {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ğüşöçıİ]/gi, '');
}

export function createInitialMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const field of importFields) {
    const candidates = [field.key, field.label, ...(synonyms[field.key] ?? [])].map(compact);
    const match = headers.find((header) => candidates.includes(compact(header)));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

export function duplicatedSources(mapping: ColumnMapping): string[] {
  const counts = Object.values(mapping).filter(Boolean).reduce<Record<string, number>>((acc, header) => ({ ...acc, [header]: (acc[header] ?? 0) + 1 }), {});
  return Object.entries(counts).filter(([, count]) => count > 1).map(([header]) => header);
}

export function parseLocalizedNumber(value: string): number | null {
  const raw = value.trim().replace(/\s/g, '');
  if (!raw) return null;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;
  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    normalized = raw.replace(decimalSeparator === ',' ? /\./g : /,/g, '').replace(decimalSeparator, '.');
  } else if (lastComma > -1) {
    const fraction = raw.slice(lastComma + 1);
    normalized = fraction.length === 3 ? raw.replace(/,/g, '') : raw.replace(',', '.');
  } else if (lastDot > -1) {
    const fraction = raw.slice(lastDot + 1);
    normalized = fraction.length === 3 ? raw.replace(/\./g, '') : raw;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function normalizeEnum(value: string, options: Array<{ value: string; label: string }>): string | null {
  const current = compact(value);
  const option = options.find((item) => compact(item.value) === current || compact(item.label) === current);
  if (option) return option.value;
  const aliases: Record<string, string> = { satilik: 'SALE', satılık: 'SALE', kiralik: 'RENT', kiralık: 'RENT', daire: 'APARTMENT', apartman: 'APARTMENT', mustakil: 'HOUSE', müstakil: 'HOUSE', turklirasi: 'TRY', tl: 'TRY', try: 'TRY' };
  return aliases[current] ?? null;
}

export function normalizeBoolean(value: string): boolean | null {
  const current = compact(value);
  if (['evet', 'var', 'true', '1', 'yes'].includes(current)) return true;
  if (['hayir', 'hayır', 'yok', 'false', '0', 'no'].includes(current)) return false;
  return null;
}
