type MaybeString = string | null | undefined;

type LabelMap = Record<string, string>;

export type ListingDetailItem = {
  key: string;
  label: string;
  value: string;
};

export type PublicationLinkState = {
  href: string | null;
  badge: string | null;
  label: string;
};

const listingTypeLabels = {
  SALE: 'Satılık',
  RENT: 'Kiralık',
} satisfies LabelMap;

const listingStatusLabels = {
  DRAFT: 'Taslak',
  PUBLISHING: 'Yayınlanıyor',
  ACTIVE: 'Aktif',
  ARCHIVED: 'Arşivlendi',
  REJECTED: 'Reddedildi',
  QUEUED: 'Sırada',
  PROCESSING: 'İşleniyor',
  PENDING: 'Bekliyor',
  FAILED: 'Başarısız',
  UPDATE_REQUIRED: 'Güncelleme gerekli',
  PUBLISHED: 'Yayınlandı',
} satisfies LabelMap;

const publicationStatusLabels = {
  QUEUED: 'Sırada',
  PROCESSING: 'Yayınlanıyor',
  PUBLISHED: 'Yayınlandı',
  FAILED: 'Başarısız',
  UPDATE_REQUIRED: 'Güncelleme gerekli',
  PENDING: 'Bekliyor',
  REJECTED: 'Reddedildi',
} satisfies LabelMap;

const propertyTypeLabels = {
  APARTMENT: 'Daire',
  HOUSE: 'Müstakil Ev',
  DETACHED_HOUSE: 'Müstakil Ev',
  VILLA: 'Villa',
  LAND: 'Arsa',
  FIELD: 'Tarla',
  COMMERCIAL: 'İş Yeri',
  OFFICE: 'Ofis',
  BUILDING: 'Bina',
  RESIDENCE: 'Rezidans',
  SUMMER_HOUSE: 'Yazlık',
  LOFT: 'Loft',
  DUPLEX: 'Dubleks',
  PENTHOUSE: 'Çatı Dubleksi',
  STUDIO: 'Stüdyo',
  OTHER: 'Diğer',
} satisfies LabelMap;

const heatingTypeLabels = {
  NONE: 'Isıtma Yok',
  CENTRAL: 'Merkezi Sistem',
  COMBI_BOILER: 'Kombi',
  UNDERFLOOR: 'Yerden Isıtma',
  STOVE: 'Soba',
  AIR_CONDITIONING: 'Klima',
  GEOTHERMAL: 'Jeotermal',
  SOLAR: 'Güneş Enerjisi',
  OTHER: 'Diğer',
} satisfies LabelMap;

const kitchenTypeLabels = {
  OPEN: 'Açık Mutfak',
  CLOSED: 'Kapalı Mutfak',
  AMERICAN: 'Amerikan Mutfak',
  OTHER: 'Diğer',
} satisfies LabelMap;

const parkingTypeLabels = {
  NONE: 'Otopark Yok',
  OPEN: 'Açık Otopark',
  COVERED: 'Kapalı Otopark',
  GARAGE: 'Garaj',
  VALET: 'Vale Otopark',
  OTHER: 'Diğer',
} satisfies LabelMap;

const occupancyStatusLabels = {
  VACANT: 'Boş',
  OWNER_OCCUPIED: 'Mülk Sahibi Oturuyor',
  TENANT_OCCUPIED: 'Kiracılı',
  TENANTED: 'Kiracılı',
  UNDER_CONSTRUCTION: 'İnşaat Halinde',
} satisfies LabelMap;

const titleDeedStatusLabels = {
  OWNERSHIP: 'Kat Mülkiyeti',
  CONDOMINIUM_EASEMENT: 'Kat İrtifakı',
  CONSTRUCTION_SERVITUDE: 'Yapı Kullanma',
  LAND_TITLE: 'Arsa Tapulu',
  SHARED: 'Hisseli Tapu',
  OTHER: 'Diğer',
} satisfies LabelMap;

const advertiserTypeLabels = {
  OWNER: 'Mülk Sahibi',
  AGENT: 'Emlak Danışmanı',
  CONSTRUCTION_COMPANY: 'İnşaat Firması',
  AGENCY: 'Emlak Ofisi',
  DEVELOPER: 'Müteahhit',
} satisfies LabelMap;

const currencyLabels = {
  TRY: 'Türk Lirası',
  USD: 'Amerikan Doları',
  EUR: 'Euro',
  GBP: 'İngiliz Sterlini',
} satisfies LabelMap;

const energyCertificateLabels = {
  A_PLUS: 'A+',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
  UNKNOWN: 'Bilinmiyor',
} satisfies LabelMap;

const detailLabelMap = {
  title: 'Başlık',
  description: 'Açıklama',
  price: 'Fiyat',
  currency: 'Para Birimi',
  listingType: 'İlan Tipi',
  propertyType: 'Gayrimenkul Tipi',
  city: 'Şehir',
  district: 'İlçe',
  address: 'Açık Adres',
  grossArea: 'Brüt Alan',
  netArea: 'Net Alan',
  roomCount: 'Oda Sayısı',
  buildingAge: 'Bina Yaşı',
  floorNumber: 'Bulunduğu Kat',
  totalFloors: 'Kat Sayısı',
  heatingType: 'Isıtma Tipi',
  bathroomCount: 'Banyo Sayısı',
  kitchenType: 'Mutfak Tipi',
  hasBalcony: 'Balkon',
  hasElevator: 'Asansör',
  parkingType: 'Otopark',
  isFurnished: 'Eşyalı',
  occupancyStatus: 'Kullanım Durumu',
  isInComplex: 'Site İçerisinde',
  complexName: 'Site Adı',
  monthlyFee: 'Aidat',
  isCreditEligible: 'Krediye Uygun',
  energyCertificate: 'Enerji Sınıfı',
  titleDeedStatus: 'Tapu Durumu',
  advertiserType: 'İlan Sahibi Türü',
  isExchangeAccepted: 'Takasa Uygun',
  housingType: 'Konut Tipi',
} satisfies LabelMap;

const listingActivityActionLabels = {
  LISTING_CREATED: 'İlan oluşturuldu',
  LISTING_UPDATED: 'İlan güncellendi',
  LISTING_ARCHIVED: 'İlan arşivlendi',
  LISTING_PUBLISHED: 'İlan yayınlandı',
  LISTING_REPUBLISHED: 'İlan yeniden yayınlandı',
  LISTING_MEDIA_UPLOADED: 'Görsel yüklendi',
  IMPORT_CONFIRMED: 'Toplu ilan aktarımı tamamlandı',
} satisfies LabelMap;

const listingActivityMetadataLabels = {
  jobsCreated: 'Oluşturulan yayın görevi',
  portalAccountCount: 'Portal hesabı sayısı',
  fields: 'Doldurulan alanlar',
  status: 'Durum',
  previousStatus: 'Önceki durum',
  newStatus: 'Yeni durum',
} satisfies LabelMap;

const listingActivityFieldLabels = {
  title: 'Başlık',
  description: 'Açıklama',
  price: 'Fiyat',
  currency: 'Para Birimi',
  listingType: 'İlan Tipi',
  propertyType: 'Gayrimenkul Tipi',
  city: 'Şehir',
  district: 'İlçe',
  address: 'Açık Adres',
} satisfies LabelMap;

export function getListingTypeLabel(value: MaybeString) {
  return lookupLabel(listingTypeLabels, value);
}

export function getListingStatusLabel(value: MaybeString) {
  return lookupLabel(listingStatusLabels, value);
}

export function getPublicationStatusLabel(value: MaybeString) {
  return lookupLabel(publicationStatusLabels, value);
}

export function getPropertyTypeLabel(value: MaybeString) {
  return lookupLabel(propertyTypeLabels, value);
}

export function getHousingTypeLabel(value: MaybeString) {
  return lookupLabel(propertyTypeLabels, value);
}

export function getHeatingTypeLabel(value: MaybeString) {
  return lookupLabel(heatingTypeLabels, value);
}

export function getKitchenTypeLabel(value: MaybeString) {
  return lookupLabel(kitchenTypeLabels, value);
}

export function getParkingTypeLabel(value: MaybeString) {
  return lookupLabel(parkingTypeLabels, value);
}

export function getOccupancyStatusLabel(value: MaybeString) {
  return lookupLabel(occupancyStatusLabels, value);
}

export function getTitleDeedStatusLabel(value: MaybeString) {
  return lookupLabel(titleDeedStatusLabels, value);
}

export function getAdvertiserTypeLabel(value: MaybeString) {
  return lookupLabel(advertiserTypeLabels, value);
}

export function getCurrencyLabel(value: MaybeString) {
  return lookupLabel(currencyLabels, value);
}

export function getEnergyCertificateLabel(value: MaybeString) {
  return lookupLabel(energyCertificateLabels, value);
}

export function getBooleanLabel(value: boolean, key?: string) {
  return value ? (key?.startsWith('has') ? 'Var' : 'Evet') : (key?.startsWith('has') ? 'Yok' : 'Hayır');
}

export function translateListingDetailLabel(key: string) {
  return detailLabelMap[key] ?? humanizeToken(key);
}

export function formatListingDetailValue(key: string, value: unknown, currency = 'TRY'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map((item) => formatListingDetailValue(key, item, currency)).join(', ');
  if (typeof value === 'boolean') return getBooleanLabel(value, key);
  if (typeof value === 'number') {
    if (['grossArea', 'netArea'].includes(key)) return `${value} m²`;
    if (key === 'monthlyFee') return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
    return String(value);
  }
  if (typeof value === 'string') {
    if (key === 'listingType') return getListingTypeLabel(value);
    if (key === 'propertyType' || key === 'housingType') return getPropertyTypeLabel(value);
    if (key === 'heatingType') return getHeatingTypeLabel(value);
    if (key === 'kitchenType') return getKitchenTypeLabel(value);
    if (key === 'parkingType') return getParkingTypeLabel(value);
    if (key === 'occupancyStatus') return getOccupancyStatusLabel(value);
    if (key === 'titleDeedStatus') return getTitleDeedStatusLabel(value);
    if (key === 'advertiserType') return getAdvertiserTypeLabel(value);
    if (key === 'currency') return getCurrencyLabel(value);
    if (key === 'energyCertificate') return getEnergyCertificateLabel(value);
    if (key === 'status' || key === 'previousStatus' || key === 'newStatus') return getListingStatusLabel(value);
    return isEnumToken(value) ? 'Diğer' : value;
  }
  return String(value);
}

export function buildListingDetailItems(details: Record<string, unknown> | null | undefined, currency: string) {
  if (!details) return [];
  return Object.entries(details)
    .filter(([key, value]) => key !== 'listingId' && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: translateListingDetailLabel(key),
      value: formatListingDetailValue(key, value, currency),
    }));
}

export function translateListingActivityAction(action: string) {
  return listingActivityActionLabels[action] ?? humanizeToken(action);
}

export function translateListingActivityMetadataKey(key: string) {
  return listingActivityMetadataLabels[key] ?? translateListingActivityFieldKey(key);
}

export function translateListingActivityFieldKey(key: string) {
  return listingActivityFieldLabels[key] ?? humanizeToken(key);
}

export function formatListingActivityChanges(changes: Record<string, unknown> | null | undefined) {
  if (!changes) return [];
  return Object.entries(changes)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${translateListingActivityMetadataKey(key)}: ${formatListingActivityValue(key, value)}`);
}

export function formatListingActivityValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) {
    if (key === 'fields') return value.map((item) => (typeof item === 'string' ? translateListingActivityFieldKey(item) : formatListingActivityValue(key, item))).join(', ');
    return value.map((item) => formatListingActivityValue(key, item)).join(', ');
  }
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (key === 'fields') return translateListingActivityFieldKey(value);
    if (key === 'listingType') return getListingTypeLabel(value);
    if (key === 'propertyType' || key === 'housingType') return getPropertyTypeLabel(value);
    if (key === 'currency') return getCurrencyLabel(value);
    if (key === 'status' || key === 'previousStatus' || key === 'newStatus') return getListingStatusLabel(value);
    if (key === 'heatingType') return getHeatingTypeLabel(value);
    if (key === 'kitchenType') return getKitchenTypeLabel(value);
    if (key === 'parkingType') return getParkingTypeLabel(value);
    if (key === 'occupancyStatus') return getOccupancyStatusLabel(value);
    if (key === 'titleDeedStatus') return getTitleDeedStatusLabel(value);
    if (key === 'advertiserType') return getAdvertiserTypeLabel(value);
    if (key === 'energyCertificate') return getEnergyCertificateLabel(value);
    return isEnumToken(value) ? 'Diğer' : value;
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([nestedKey, nestedValue]) => `${translateListingActivityMetadataKey(nestedKey)}: ${formatListingActivityValue(nestedKey, nestedValue)}`)
      .join(' · ');
  }
  return String(value);
}

export function getPublicationLinkState(value: MaybeString): PublicationLinkState {
  if (!value) return { href: null, badge: null, label: 'Yayın bağlantısı yok' };
  const parsed = parseUrl(value);
  if (!parsed) return { href: null, badge: null, label: 'Yayın bağlantısı yok' };
  if (!['http:', 'https:'].includes(parsed.protocol)) return { href: null, badge: null, label: 'Yayın bağlantısı yok' };
  if (isTestPortalHost(parsed.hostname)) return { href: null, badge: 'Test portalı', label: 'Test yayını oluşturuldu' };
  return { href: parsed.toString(), badge: null, label: 'Portalda Aç' };
}

function lookupLabel(labels: LabelMap, value: MaybeString) {
  if (value === null || value === undefined || value === '') return 'Diğer';
  return labels[value] ?? (isEnumToken(value) ? 'Diğer' : value);
}

function isEnumToken(value: string) {
  return /^[A-Z0-9_]+$/.test(value);
}

function humanizeToken(value: string) {
  const normalized = value
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) return 'Diğer';
  const lowered = normalized.toLocaleLowerCase('tr-TR');
  return lowered.replace(/^./, (char) => char.toLocaleUpperCase('tr-TR'));
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isTestPortalHost(hostname: string) {
  const lower = hostname.toLocaleLowerCase('en-US');
  return lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower.endsWith('.local') || lower.endsWith('.test') || lower.endsWith('.invalid') || lower.includes('mock-');
}
