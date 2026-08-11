export const housingTypesByPropertyType = {
  APARTMENT: ['APARTMENT', 'RESIDENCE', 'LOFT', 'DUPLEX', 'PENTHOUSE', 'STUDIO', 'OTHER'],
  VILLA: ['VILLA', 'DUPLEX', 'PENTHOUSE', 'OTHER'],
  HOUSE: ['DETACHED_HOUSE', 'SUMMER_HOUSE', 'DUPLEX', 'OTHER'],
} as const;

export function isHousingTypeCompatible(propertyType: string, housingType: string): boolean {
  const allowed = housingTypesByPropertyType[propertyType as keyof typeof housingTypesByPropertyType];
  return allowed ? (allowed as readonly string[]).includes(housingType) : housingType === 'OTHER';
}

export function getHousingTypesForPropertyType(propertyType: string): readonly string[] {
  return housingTypesByPropertyType[propertyType as keyof typeof housingTypesByPropertyType] ?? ['OTHER'];
}
