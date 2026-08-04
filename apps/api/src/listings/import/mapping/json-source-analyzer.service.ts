import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { SourceDataset, SourceRow } from './source-dataset';

const maxBytes = 5 * 1024 * 1024;
const maxRows = 1_000;
const maxDepth = 10;
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);

@Injectable()
export class JsonSourceAnalyzerService {
  analyze(file: Express.Multer.File): SourceDataset {
    if (!file || !file.originalname.toLowerCase().endsWith('.json')) throw new UnprocessableEntityException('Yalnızca .json dosyası yüklenebilir.');
    if (file.size > maxBytes) throw new UnprocessableEntityException('JSON dosyası en fazla 5 MB olabilir.');
    const content = file.buffer.toString('utf8');
    if (content.includes('\uFFFD')) throw new UnprocessableEntityException('JSON dosyası UTF-8 olmalıdır.');

    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new UnprocessableEntityException('JSON söz dizimi geçersiz.'); }
    if (parsed === null || typeof parsed !== 'object') throw new UnprocessableEntityException('JSON kök değeri array veya object olmalıdır.');
    assertSafe(parsed, 0);
    const records = this.records(parsed);
    if (records.length > maxRows) throw new UnprocessableEntityException('JSON dosyası en fazla 1.000 kayıt içerebilir.');
    const rows = records.map((record, index) => ({ row: index + 1, values: flatten(record) }));
    const fields = [...new Set(rows.flatMap((row) => Object.keys(row.values)))];
    return { sourceType: 'JSON', fields, rows, warnings: shapeWarnings(rows) };
  }

  private records(value: object): Record<string, unknown>[] {
    if (Array.isArray(value)) return validateRecords(value);
    const candidates = Object.entries(value).filter(([, child]) => Array.isArray(child));
    if (candidates.length > 1) throw new UnprocessableEntityException(`Birden fazla kayıt array'i bulundu: ${candidates.map(([key]) => key).join(', ')}. Lütfen tek kayıt array'i içeren bir JSON yükleyin.`);
    if (candidates.length === 1) return validateRecords(candidates[0][1] as unknown[]);
    return [value as Record<string, unknown>];
  }
}

function validateRecords(records: unknown[]): Record<string, unknown>[] {
  if (!records.every(isPlainObject)) throw new UnprocessableEntityException('Kayıt array’i yalnızca object kayıtlar içermelidir.');
  return records as Record<string, unknown>[];
}
function isPlainObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function assertSafe(value: unknown, depth: number): void {
  if (depth > maxDepth) throw new UnprocessableEntityException(`JSON nested depth en fazla ${maxDepth} olabilir.`);
  if (Array.isArray(value)) { for (const item of value) assertSafe(item, depth + 1); return; }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) { if (unsafeKeys.has(key)) throw new UnprocessableEntityException(`Güvenli olmayan JSON alanı reddedildi: ${key}.`); assertSafe(child, depth + 1); }
}
function flatten(value: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (current: unknown, path: string, depth: number): void => {
    if (depth > maxDepth) throw new UnprocessableEntityException(`JSON nested depth en fazla ${maxDepth} olabilir.`);
    if (isPlainObject(current)) { for (const [key, child] of Object.entries(current)) visit(child, path ? `${path}.${key}` : key, depth + 1); return; }
    if (Array.isArray(current)) { result[path] = JSON.stringify(current); return; }
    if (current !== null && current !== undefined) result[path] = String(current);
  };
  for (const [key, child] of Object.entries(value)) visit(child, key, 1);
  return result;
}
function shapeWarnings(rows: SourceRow[]): string[] {
  const shapes = rows.map((row) => new Set(Object.keys(row.values)));
  const hasDifferentShapes = shapes.some((shape, index) => shapes.slice(index + 1).some((other) => ![...shape].some((field) => other.has(field))));
  return hasDifferentShapes ? ['Bazı JSON kayıtları tamamen farklı alan yapılarına sahip; mapping sonuçlarını gözden geçirin.'] : [];
}
