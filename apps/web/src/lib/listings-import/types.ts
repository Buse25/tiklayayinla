export type ImportStep = 0 | 1 | 2 | 3;
export type ImportRow = { rowNumber: number; values: Record<string, string> };
export type ParsedImportFile = { fileName: string; headers: string[]; rows: ImportRow[] };

export type ListingImportField = {
  key: string;
  label: string;
  required?: boolean;
  type: 'string' | 'number' | 'enum' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  group: 'Temel' | 'Konum' | 'Konut Detayı' | 'Referans';
};

export type ColumnMapping = Record<string, string>;
export type ImportIssue = { field?: string; code: string; message: string };
export type RowStatus = 'VALID' | 'WARNING' | 'ERROR';

export type ListingImportPayload = {
  title: string;
  description: string;
  price: number;
  currency: string;
  listingType: string;
  propertyType: string;
  city: string;
  district: string;
  address: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  residentialDetails?: Record<string, string | number | boolean>;
  facades?: string[];
  interiorFeatures?: string[];
  exteriorFeatures?: string[];
  nearbyPlaces?: string[];
  transportation?: string[];
  views?: string[];
  accessibilityFeatures?: string[];
  externalId?: string;
  referenceNo?: string;
};

export type ValidatedImportRow = {
  rowNumber: number;
  source: Record<string, string>;
  status: RowStatus;
  issues: ImportIssue[];
  payload?: ListingImportPayload;
};

export type ValidationSummary = {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  payloadRows: number;
};

export const maxImportFileSizeBytes = 5 * 1024 * 1024;
