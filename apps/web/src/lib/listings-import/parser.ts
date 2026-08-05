import * as XLSX from 'xlsx';
import type { ImportRow, ParsedImportFile } from './types';

function normalizeHeader(value: unknown, fallback: string): string {
  const text = String(value ?? '').replace(/^\uFEFF/, '').trim();
  return text || fallback;
}

function isEmptyRow(values: Record<string, string>) {
  return Object.values(values).every((value) => value.trim() === '');
}

function rowsFromMatrix(fileName: string, matrix: string[][]): ParsedImportFile {
  const first = matrix.findIndex((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (first === -1) return { fileName, headers: [], rows: [] };
  const headers = matrix[first].map((cell, index) => normalizeHeader(cell, `Kolon ${index + 1}`));
  const rows: ImportRow[] = matrix.slice(first + 1).map((row, index) => {
    const values = Object.fromEntries(headers.map((header, columnIndex) => [header, String(row[columnIndex] ?? '').trim()]));
    return { rowNumber: first + index + 2, values };
  }).filter((row) => !isEmptyRow(row.values));
  return { fileName, headers, rows };
}

export function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const scores = [',', ';', '\t'].map((delimiter) => ({ delimiter, count: parseCsvText(sample, delimiter as ',' | ';' | '\t').headers.length }));
  return scores.sort((a, b) => b.count - a.count)[0].delimiter as ',' | ';' | '\t';
}

export function parseCsvText(text: string, delimiter?: ',' | ';' | '\t', fileName = 'dosya.csv'): ParsedImportFile {
  const separator = delimiter ?? detectCsvDelimiter(text);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (quoted && next === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === separator && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rowsFromMatrix(fileName, rows);
}

export function parseWorkbookBuffer(buffer: ArrayBuffer, fileName = 'dosya.xlsx'): ParsedImportFile {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return { fileName, headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[firstSheet], { header: 1, defval: '', raw: false });
  return rowsFromMatrix(fileName, matrix);
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'csv') return parseCsvText(await file.text(), undefined, file.name);
  if (extension === 'xlsx') return parseWorkbookBuffer(await file.arrayBuffer(), file.name);
  throw new Error('Sadece .csv ve .xlsx dosyaları desteklenir.');
}
