import carData from './vehicle-data/car_data.json';

type RawVehicleCatalog = { brands?: Record<string, unknown> };

const rawBrands = (carData as RawVehicleCatalog).brands ?? {};

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result || null;
}

function key(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

const catalog = new Map<string, { brand: string; models: string[] }>();
for (const [rawBrand, rawModels] of Object.entries(rawBrands)) {
  const brand = clean(rawBrand);
  if (!brand || !Array.isArray(rawModels)) continue;
  const models = [...new Set(rawModels.map(clean).filter((model): model is string => Boolean(model)))];
  const existing = catalog.get(key(brand));
  if (existing) {
    existing.models = [...new Set([...existing.models, ...models])];
  } else {
    catalog.set(key(brand), { brand, models });
  }
}

const brands = [...catalog.values()].filter((item) => item.models.length > 0).sort((a, b) => a.brand.localeCompare(b.brand, 'tr-TR'));

export function getVehicleBrands(): string[] {
  return brands.map((item) => item.brand);
}

export function getModelsByBrand(brand: string): string[] {
  return catalog.get(key(brand))?.models ?? [];
}

export function getCanonicalVehicleBrand(brand: string): string | undefined {
  return catalog.get(key(brand))?.brand;
}

export function getCanonicalVehicleModel(brand: string, model: string): string | undefined {
  const models = getModelsByBrand(brand);
  return models.find((item) => key(item) === key(model));
}

export function isValidVehicleBrand(brand: string): boolean {
  return Boolean(getCanonicalVehicleBrand(brand));
}

export function isValidVehicleBrandModel(brand: string, model: string): boolean {
  return Boolean(getCanonicalVehicleBrand(brand) && getCanonicalVehicleModel(brand, model));
}
