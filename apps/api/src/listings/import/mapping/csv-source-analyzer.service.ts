import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type { SourceDataset } from './source-dataset';

export type { SourceRow } from './source-dataset';
export type CsvAnalysis = SourceDataset;

@Injectable()
export class CsvSourceAnalyzerService {
  analyze(file: Express.Multer.File): CsvAnalysis {
    if (!file || !file.originalname.toLowerCase().endsWith('.csv')) throw new BadRequestException('Yalnızca .csv dosyası yüklenebilir.');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('CSV dosyası en fazla 5 MB olabilir.');
    const content = file.buffer.toString('utf8');
    if (content.includes('\uFFFD')) throw new BadRequestException('CSV dosyası UTF-8 veya UTF-8 BOM olmalıdır.');
    const header = content.replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim());
    if (!header) throw new BadRequestException('CSV dosyası boş.');
    const delimiter = detectDelimiter(header);
    try {
      const records = parse(content, { bom: true, columns: true, delimiter, trim: true, skip_empty_lines: true, relax_column_count: false }) as Record<string, string>[];
      if (records.length > 1000) throw new BadRequestException('CSV dosyası en fazla 1.000 veri satırı içerebilir.');
      const fields = records.length ? Object.keys(records[0]) : header.replace(/^\uFEFF/, '').split(delimiter).map((field) => field.trim());
      if (!fields.length || new Set(fields).size !== fields.length) throw new BadRequestException('CSV header alanları geçersiz veya tekrar ediyor.');
      return { sourceType: 'CSV', delimiter, fields, rows: records.map((values, index) => ({ row: index + 2, values })), warnings: [] };
    } catch (error) { if (error instanceof BadRequestException) throw error; throw new BadRequestException('CSV biçimi geçersiz.'); }
  }
}
function detectDelimiter(header: string): string { return [';', ',', '\t'].map((delimiter) => ({ delimiter, count: header.split(delimiter).length - 1 })).sort((a, b) => b.count - a.count)[0].count > 0 ? [';', ',', '\t'].map((delimiter) => ({ delimiter, count: header.split(delimiter).length - 1 })).sort((a, b) => b.count - a.count)[0].delimiter : ';'; }
