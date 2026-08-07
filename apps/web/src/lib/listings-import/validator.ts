import { importFields, normalizeBoolean, normalizeEnum, parseLocalizedNumber } from './normalizer';
import type {
  ColumnMapping,
  ImportIssue,
  ImportRow,
  ListingImportPayload,
  ParsedImportFile,
  RowStatus,
  ValidatedImportRow,
  ValidationSummary,
} from './types';

const residentialFields = new Set(importFields.filter((field) => field.group === 'Konut Detayı').map((field) => field.key));

function cell(row: Record<string, string>, header?: string) {
  return header ? (row[header] ?? '').trim() : '';
}

function issue(field: string, code: string, message: string): ImportIssue {
  return { field, code, message };
}

function validateLength(issues: ImportIssue[], field: string, value: string, min: number, max: number) {
  if (value.length < min) issues.push(issue(field, 'MIN_LENGTH', `${label(field)} en az ${min} karakter olmalıdır.`));
  if (value.length > max) issues.push(issue(field, 'MAX_LENGTH', `${label(field)} en fazla ${max} karakter olabilir.`));
}

function label(fieldKey: string) {
  return importFields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
}

function acceptedValues(fieldKey: string) {
  const field = importFields.find((item) => item.key === fieldKey);
  const options = field?.options?.map((option) => option.label).filter(Boolean) ?? [];
  return options.length ? ` Kabul edilen değerler: ${options.join(', ')}.` : '';
}

function normalizeRow(source: Record<string, string>, mapping: ColumnMapping): { payload?: ListingImportPayload; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const flat: Record<string, string | number | boolean> = {};
  const residentialDetails: Record<string, string | number | boolean> = {};

  for (const field of importFields) {
    const raw = cell(source, mapping[field.key]);
    if (!raw) {
      if (field.required) issues.push(issue(field.key, 'REQUIRED', `${field.label} zorunludur.`));
      continue;
    }
    if (field.type === 'number') {
      const number = parseLocalizedNumber(raw);
      if (number === null || (number <= 0 && !['buildingAge', 'bathroomCount', 'monthlyFee'].includes(field.key))) {
        issues.push(issue(field.key, 'INVALID_NUMBER', `${field.label} geçerli bir sayı olmalıdır.`));
        continue;
      }
      if (residentialFields.has(field.key)) residentialDetails[field.key] = number;
      else flat[field.key] = number;
    } else if (field.type === 'enum') {
      const normalized = normalizeEnum(raw, field.options ?? []);
      if (!normalized) {
        issues.push(issue(field.key, 'INVALID_ENUM', `${field.label} geçerli bir değer olmalıdır.${acceptedValues(field.key)}`));
        continue;
      }
      if (residentialFields.has(field.key)) residentialDetails[field.key] = normalized;
      else flat[field.key] = normalized;
    } else if (field.type === 'boolean') {
      const normalized = normalizeBoolean(raw);
      if (normalized === null) {
        issues.push(issue(field.key, 'INVALID_BOOLEAN', `${field.label} için Evet/Hayır, Var/Yok gibi bir değer girin.`));
        continue;
      }
      residentialDetails[field.key] = normalized;
    } else if (residentialFields.has(field.key)) residentialDetails[field.key] = raw;
    else flat[field.key] = raw;
  }

  if (typeof flat.title === 'string') validateLength(issues, 'title', flat.title, 5, 160);
  if (typeof flat.description === 'string') validateLength(issues, 'description', flat.description, 20, 10_000);
  if (typeof flat.city === 'string' && flat.city.length > 100) issues.push(issue('city', 'MAX_LENGTH', 'Şehir en fazla 100 karakter olabilir.'));
  if (typeof flat.district === 'string' && flat.district.length > 100) issues.push(issue('district', 'MAX_LENGTH', 'İlçe en fazla 100 karakter olabilir.'));
  if (typeof flat.address === 'string' && flat.address.length > 500) issues.push(issue('address', 'MAX_LENGTH', 'Adres en fazla 500 karakter olabilir.'));

  if (issues.some((item) => item.code !== 'DUPLICATE_REFERENCE')) return { issues };
  const payload: ListingImportPayload = {
    title: String(flat.title),
    description: String(flat.description),
    price: Number(flat.price),
    currency: String(flat.currency),
    listingType: String(flat.listingType),
    propertyType: String(flat.propertyType),
    city: String(flat.city),
    district: String(flat.district),
    address: String(flat.address),
    ...(flat.neighborhood && { neighborhood: String(flat.neighborhood) }),
    ...(flat.externalId && { externalId: String(flat.externalId) }),
    ...(flat.referenceNo && { referenceNo: String(flat.referenceNo) }),
    ...(Object.keys(residentialDetails).length > 0 && { residentialDetails }),
  };
  return { payload, issues };
}

export function validateImportRow(row: ImportRow, mapping: ColumnMapping): ValidatedImportRow {
  const { payload, issues } = normalizeRow(row.values, mapping);
  const hasError = issues.some((item) => item.code !== 'DUPLICATE_REFERENCE');
  const status: RowStatus = hasError ? 'ERROR' : issues.length ? 'WARNING' : 'VALID';
  return { rowNumber: row.rowNumber, source: row.values, status, issues, payload: hasError ? undefined : payload };
}

export function buildValidationResult(rows: ValidatedImportRow[]) {
  return {
    rows,
    summary: summarizeValidatedRows(rows),
    payloads: rows.flatMap((row) => (row.payload ? [row.payload] : [])),
  };
}

export function summarizeValidatedRows(rows: ValidatedImportRow[]): ValidationSummary {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status === 'VALID').length,
    warningRows: rows.filter((row) => row.status === 'WARNING').length,
    errorRows: rows.filter((row) => row.status === 'ERROR').length,
    payloadRows: rows.filter((row) => row.payload).length,
  };
}

export function validateImport(
  parsed: ParsedImportFile,
  mapping: ColumnMapping,
): { rows: ValidatedImportRow[]; summary: ValidationSummary; payloads: ListingImportPayload[] } {
  const referenceCounts = new Map<string, number>();
  const referenceForRow = new Map<number, string>();
  for (const row of parsed.rows) {
    const reference = cell(row.values, mapping.externalId) || cell(row.values, mapping.referenceNo);
    if (reference) {
      referenceForRow.set(row.rowNumber, reference);
      referenceCounts.set(reference, (referenceCounts.get(reference) ?? 0) + 1);
    }
  }

  const rows = parsed.rows.map((row) => {
    const validated = validateImportRow(row, mapping);
    const reference = referenceForRow.get(row.rowNumber);
    if (reference && (referenceCounts.get(reference) ?? 0) > 1) {
      validated.issues.push(issue('referenceNo', 'DUPLICATE_REFERENCE', 'Dosya içinde aynı referans numarası birden fazla kez geçiyor.'));
    }
    const hasError = validated.issues.some((item) => item.code !== 'DUPLICATE_REFERENCE');
    const status: RowStatus = hasError ? 'ERROR' : validated.issues.length ? 'WARNING' : 'VALID';
    return { ...validated, status, payload: hasError ? undefined : validated.payload };
  });

  return buildValidationResult(rows);
}

export function missingRequiredMappings(mapping: ColumnMapping): string[] {
  return importFields.filter((field) => field.required && !mapping[field.key]).map((field) => field.key);
}
