export type OrganizationType = 'REAL_ESTATE_AGENCY' | 'AUTO_DEALER' | 'OTHER' | null | undefined;

export function canUsePropertyListings(organizationType: OrganizationType): boolean {
  return !organizationType || organizationType === 'REAL_ESTATE_AGENCY';
}

export function sectorLabel(organizationType: OrganizationType): string {
  if (!organizationType) return 'Bireysel hesap';
  return {
    REAL_ESTATE_AGENCY: 'Emlak Ofisi',
    AUTO_DEALER: 'Galeri / Otomotiv',
    OTHER: 'Diğer',
  }[organizationType];
}

export function sectorRestrictionMessage(organizationType: OrganizationType): string {
  if (organizationType === 'AUTO_DEALER') return 'Bu hesap türü şimdilik araç domaini beklediği için property ilan oluşturamaz, içe aktaramaz veya yayınlayamaz.';
  if (organizationType === 'OTHER') return 'Bu hesap türü property ilan akışında desteklenmiyor.';
  return '';
}
