import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export const CSV_COLUMNS = ['title', 'description', 'price', 'currency', 'listing_type', 'property_type', 'city', 'district', 'neighborhood', 'address', 'latitude', 'longitude', 'gross_area', 'net_area', 'room_count', 'building_age', 'floor_number', 'total_floors', 'heating_type', 'bathroom_count', 'kitchen_type', 'has_balcony', 'has_elevator', 'parking_type', 'is_furnished', 'occupancy_status', 'is_in_complex', 'complex_name', 'monthly_fee', 'is_credit_eligible', 'energy_certificate', 'title_deed_status', 'advertiser_type', 'is_exchange_accepted', 'housing_type', 'facades', 'interior_features', 'exterior_features', 'nearby_places', 'transportation', 'views', 'accessibility_features'] as const;
export const REQUIRED_COLUMNS = ['title', 'description', 'price', 'currency', 'listing_type', 'property_type', 'city', 'district', 'address'] as const;
export type CsvRecord = Record<string, string>;

@Injectable()
export class CsvListingParserService {
  parse(file: Express.Multer.File): Array<{ row: number; values: CsvRecord }> {
    if (!file || !file.originalname.toLowerCase().endsWith('.csv')) throw new BadRequestException('Yalnızca .csv dosyası yüklenebilir.');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('CSV dosyası en fazla 5 MB olabilir.');
    const content = file.buffer.toString('utf8');
    if (content.includes('\uFFFD')) throw new BadRequestException('CSV dosyası UTF-8 veya UTF-8 BOM encoding ile gönderilmelidir.');
    const headerLine = content.replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim());
    if (!headerLine) throw new BadRequestException('CSV dosyası boş.');
    const headers = headerLine.split(';').map((value) => value.trim());
    const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
    if (missing.length) throw new BadRequestException(`Zorunlu CSV kolonları eksik: ${missing.join(', ')}.`);
    if (headers.some((header) => !CSV_COLUMNS.includes(header as typeof CSV_COLUMNS[number]))) throw new BadRequestException('CSV içinde tanımsız kolon bulunuyor.');
    if (new Set(headers).size !== headers.length) throw new BadRequestException('CSV header kolonları tekrar edemez.');
    try {
      const records = parse(content, { bom: true, columns: true, delimiter: ';', trim: true, skip_empty_lines: true, relax_column_count: false }) as CsvRecord[];
      if (records.length > 1000) throw new BadRequestException('CSV dosyası en fazla 1.000 veri satırı içerebilir.');
      return records.map((values, index) => ({ row: index + 2, values }));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('CSV biçimi geçersiz; ayırıcı olarak ; kullanın.');
    }
  }
}
