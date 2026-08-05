import type { ListingImportPayload, ValidatedImportRow } from './types';
import type { BackendImportMappingItem } from './backend-types';

const fieldMap = {
  listingType: 'listing_type',
  propertyType: 'property_type',
  grossArea: 'gross_area',
  netArea: 'net_area',
  roomCount: 'room_count',
  buildingAge: 'building_age',
  floorNumber: 'floor_number',
  totalFloors: 'total_floors',
  heatingType: 'heating_type',
  bathroomCount: 'bathroom_count',
  kitchenType: 'kitchen_type',
  hasBalcony: 'has_balcony',
  hasElevator: 'has_elevator',
  parkingType: 'parking_type',
  isFurnished: 'is_furnished',
  occupancyStatus: 'occupancy_status',
  isInComplex: 'is_in_complex',
  complexName: 'complex_name',
  monthlyFee: 'monthly_fee',
  isCreditEligible: 'is_credit_eligible',
  energyCertificate: 'energy_certificate',
  titleDeedStatus: 'title_deed_status',
  advertiserType: 'advertiser_type',
  isExchangeAccepted: 'is_exchange_accepted',
  housingType: 'housing_type',
  interiorFeatures: 'interior_features',
  exteriorFeatures: 'exterior_features',
  nearbyPlaces: 'nearby_places',
  accessibilityFeatures: 'accessibility_features',
} as const;

const directFields = ['title', 'description', 'price', 'currency', 'city', 'district', 'neighborhood', 'address', 'latitude', 'longitude', 'facades', 'transportation', 'views'] as const;
const unsupportedFields = ['externalId', 'referenceNo'] as const;
const backendCsvColumns = ['title', 'description', 'price', 'currency', 'listing_type', 'property_type', 'city', 'district', 'neighborhood', 'address', 'latitude', 'longitude', 'gross_area', 'net_area', 'room_count', 'building_age', 'floor_number', 'total_floors', 'heating_type', 'bathroom_count', 'kitchen_type', 'has_balcony', 'has_elevator', 'parking_type', 'is_furnished', 'occupancy_status', 'is_in_complex', 'complex_name', 'monthly_fee', 'is_credit_eligible', 'energy_certificate', 'title_deed_status', 'advertiser_type', 'is_exchange_accepted', 'housing_type', 'facades', 'interior_features', 'exterior_features', 'nearby_places', 'transportation', 'views', 'accessibility_features'];

export type BackendImportPreparedPayload = {
  rows: Array<{ sourceRowNumber: number; values: Record<string, string> }>;
  mapping: BackendImportMappingItem[];
  unsupportedWarnings: string[];
  backendJson: Record<string, string>[];
};

export function prepareBackendImportRows(rows: ValidatedImportRow[]): BackendImportPreparedPayload {
  const preparedRows = rows.filter((row) => row.payload).map((row) => ({ sourceRowNumber: row.rowNumber, values: toBackendRecord(row.payload!) }));
  const targets = Array.from(new Set(preparedRows.flatMap((row) => Object.keys(row.values))));
  return {
    rows: preparedRows,
    backendJson: preparedRows.map((row) => row.values),
    mapping: targets.map((target) => ({ sourceField: target, targetField: target, transformation: null })),
    unsupportedWarnings: unsupportedWarnings(rows.flatMap((row) => row.payload ? [row.payload] : [])),
  };
}

export function createBackendImportJsonFile(records: Record<string, string>[], fileName = 'tiklayayinla-import.json'): File {
  return new File([JSON.stringify(records)], fileName, { type: 'application/json;charset=utf-8' });
}

export function createBackendImportCsvFile(records: Record<string, string>[], fileName = 'tiklayayinla-import.csv'): File {
  const lines = [backendCsvColumns.join(';'), ...records.map((record) => backendCsvColumns.map((column) => csvCell(record[column] ?? '')).join(';'))];
  return new File([`\uFEFF${lines.join('\r\n')}\r\n`], fileName, { type: 'text/csv;charset=utf-8' });
}

export function mapBackendRowToSourceRow(prepared: BackendImportPreparedPayload, backendRow: number): number {
  return prepared.rows[backendRow - 1]?.sourceRowNumber ?? backendRow;
}

function toBackendRecord(payload: ListingImportPayload): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of directFields) put(record, field, payload[field as keyof ListingImportPayload]);
  put(record, 'listing_type', payload.listingType);
  put(record, 'property_type', payload.propertyType);
  for (const [field, target] of Object.entries(fieldMap)) {
    if (field === 'listingType' || field === 'propertyType') continue;
    put(record, target, payload[field as keyof ListingImportPayload]);
  }
  for (const [field, value] of Object.entries(payload.residentialDetails ?? {})) {
    put(record, fieldMap[field as keyof typeof fieldMap] ?? field, value);
  }
  return record;
}

function put(record: Record<string, string>, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return;
  if (Array.isArray(value)) {
    const list = value.map((item) => String(item).trim()).filter(Boolean);
    if (list.length) record[key] = list.join('|');
    return;
  }
  record[key] = typeof value === 'boolean' ? String(value) : String(value);
}

function unsupportedWarnings(payloads: ListingImportPayload[]) {
  const fields = unsupportedFields.filter((field) => payloads.some((payload) => Boolean(payload[field])));
  return fields.map((field) => `${field === 'externalId' ? 'Harici ID' : 'Referans No'} alanı backend import sözleşmesinde kayıtlı değil; ilan oluşturulurken kaydedilmeyecek.`);
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
