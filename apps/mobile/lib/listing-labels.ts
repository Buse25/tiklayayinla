const labels: Record<string, string> = {
  SALE: 'Satılık', RENT: 'Kiralık', TRY: 'TL', USD: 'Dolar', EUR: 'Euro',
  APARTMENT: 'Daire', HOUSE: 'Müstakil Ev', VILLA: 'Villa', LAND: 'Arsa', COMMERCIAL: 'Ticari İşyeri', OFFICE: 'Ofis', OTHER: 'Diğer',
  GASOLINE: 'Benzin', DIESEL: 'Dizel', HYBRID: 'Hibrit', ELECTRIC: 'Elektrik', LPG: 'LPG',
  MANUAL: 'Manuel', AUTOMATIC: 'Otomatik', SEMI_AUTOMATIC: 'Yarı Otomatik',
  SEDAN: 'Sedan', HATCHBACK: 'Hatchback', SUV: 'SUV', COUPE: 'Coupe', STATION_WAGON: 'Station Wagon', PICKUP: 'Pick-up', VAN: 'Van', MINIVAN: 'Minivan',
  ACTIVE: 'Aktif', DRAFT: 'Taslak', SUSPENDED: 'Askıda', DELETED: 'Silinmiş', PUBLISHED: 'Yayınlandı', PROCESSING: 'İşleniyor', QUEUED: 'Sırada', FAILED: 'Başarısız', CONNECTED: 'Bağlı', NOT_TESTED: 'Test edilmedi',
  CENTRAL_HEATING: 'Merkezi Isıtma', NATURAL_GAS: 'Doğalgaz', STOVE: 'Soba', FLOOR_HEATING: 'Yerden Isıtma', AIR_CONDITIONER: 'Klima',
  OPEN: 'Açık', CLOSED: 'Kapalı', FURNISHED: 'Eşyalı', UNFURNISHED: 'Eşyasız',
};

export function listingLabel(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return 'Belirtilmedi';
  return labels[String(value)] ?? String(value).replaceAll('_', ' ').toLocaleLowerCase('tr-TR').replace(/^./, (char) => char.toLocaleUpperCase('tr-TR'));
}
