import { getCities, getDistrictsByCityCode, isCityName } from 'turkey-neighbourhoods';

export type TurkeyCity = { code: string; name: string };

export function getTurkeyCities(): TurkeyCity[] {
  return getCities().map((city) => ({ code: city.code, name: city.name }));
}

export function getDistrictsByCity(city: string): string[] {
  const match = getTurkeyCities().find((item) => item.name === city);
  return match ? [...getDistrictsByCityCode(match.code)] : [];
}

export function isValidTurkeyCity(city: string): boolean {
  return isCityName(city);
}

export function isValidTurkeyCityDistrict(city: string, district: string): boolean {
  return getDistrictsByCity(city).includes(district);
}
