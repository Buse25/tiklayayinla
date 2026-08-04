import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ListingsService } from '../listings.service';
import { CsvListingParserService } from './csv-listing-parser.service';
import { CsvListingValidatorService, type ValidImportRow } from './csv-listing-validator.service';
import type { ListingImportConfirmResponseDto, ListingImportErrorDto, ListingImportPreviewResponseDto } from './dto/listing-import.dto';

type Preview = { userId: string; expiresAt: number; totalRows: number; validRows: ValidImportRow[]; invalidRows: number; duplicateRows: number; errors: ListingImportErrorDto[] };

@Injectable()
export class ListingImportService {
  private readonly previews = new Map<string, Preview>();
  constructor(private readonly parser: CsvListingParserService, private readonly validator: CsvListingValidatorService, private readonly listings: ListingsService) {}

  async preview(userId: string, file: Express.Multer.File): Promise<ListingImportPreviewResponseDto> {
    this.clearExpired();
    const rows = this.parser.parse(file);
    const result = await this.validator.validateRows(rows);
    const previewToken = randomUUID();
    this.previews.set(previewToken, { userId, expiresAt: Date.now() + 15 * 60_000, totalRows: rows.length, validRows: result.validRows, invalidRows: rows.length - result.validRows.length - result.duplicateRows, duplicateRows: result.duplicateRows, errors: result.errors });
    return { previewToken, summary: { totalRows: rows.length, validRows: result.validRows.length, invalidRows: rows.length - result.validRows.length - result.duplicateRows, duplicateRows: result.duplicateRows }, validRows: result.validRows.slice(0, 20).map((row) => row.summary), errors: result.errors.slice(0, 200) };
  }

  async previewRows(userId: string, rows: Array<{ row: number; values: Record<string, string> }>): Promise<ListingImportPreviewResponseDto> {
    this.clearExpired();
    const result = await this.validator.validateRows(rows);
    const previewToken = randomUUID();
    const invalidRows = rows.length - result.validRows.length - result.duplicateRows;
    this.previews.set(previewToken, { userId, expiresAt: Date.now() + 15 * 60_000, totalRows: rows.length, validRows: result.validRows, invalidRows, duplicateRows: result.duplicateRows, errors: result.errors });
    return { previewToken, summary: { totalRows: rows.length, validRows: result.validRows.length, invalidRows, duplicateRows: result.duplicateRows }, validRows: result.validRows.slice(0, 20).map((row) => row.summary), errors: result.errors.slice(0, 200) };
  }

  async confirm(userId: string, previewToken: string): Promise<ListingImportConfirmResponseDto> {
    this.clearExpired();
    const preview = this.previews.get(previewToken);
    if (!preview) throw new BadRequestException('Preview token geçersiz veya süresi dolmuş.');
    if (preview.userId !== userId) throw new UnauthorizedException('Bu preview token başka bir kullanıcıya ait.');
    this.previews.delete(previewToken);
    const createdListings: Array<{ row: number; id: string; listingNo: string }> = []; const errors: ListingImportErrorDto[] = [];
    for (let offset = 0; offset < preview.validRows.length; offset += 100) {
      const batch = preview.validRows.slice(offset, offset + 100);
      const results = await Promise.allSettled(batch.map(async (row) => ({ row: row.row, listing: await this.listings.create(userId, row.dto) })));
      for (const result of results) {
        if (result.status === 'fulfilled') createdListings.push({ row: result.value.row, id: result.value.listing.id, listingNo: result.value.listing.listingNo });
        else errors.push({ row: batch[results.indexOf(result)].row, column: 'row', code: 'CREATE_FAILED', message: 'İlan oluşturulamadı.', value: null });
      }
    }
    return { summary: { totalRows: preview.totalRows, createdRows: createdListings.length, failedRows: errors.length, skippedRows: preview.totalRows - preview.validRows.length }, createdListings, errors: errors.slice(0, 200) };
  }

  template(): string {
    const header = 'title;description;price;currency;listing_type;property_type;city;district;neighborhood;address;latitude;longitude;gross_area;net_area;room_count;building_age;floor_number;total_floors;heating_type;bathroom_count;kitchen_type;has_balcony;has_elevator;parking_type;is_furnished;occupancy_status;is_in_complex;complex_name;monthly_fee;is_credit_eligible;energy_certificate;title_deed_status;advertiser_type;is_exchange_accepted;housing_type;facades;interior_features;exterior_features;nearby_places;transportation;views;accessibility_features';
    const example = ['Kadıköyde 2+1 satılık daire', 'Merkezi konumda, ulaşımı kolay ve bakımlı satılık daire.', '4750000', 'TRY', 'SALE', 'APARTMENT', 'İstanbul', 'Kadıköy', 'Caferağa', 'Moda Cad. No:1', '40.9876', '29.0275', '110', '90', '2+1', '5', '3', '8', 'COMBI_BOILER', '1', 'CLOSED', 'true', 'true', 'COVERED', 'false', 'VACANT', 'false', '', '2500', 'true', 'B', 'OWNERSHIP', 'AGENT', 'false', 'APARTMENT', 'SOUTH|EAST', 'SMART_HOME|FIREPLACE', 'SECURITY', 'HOSPITAL|MARKET', 'METRO', 'SEA_VIEW', 'RAMP'].map(safeCsv).join(';');
    return `\uFEFF${header}\r\n${example}\r\n`;
  }

  private clearExpired(): void { const now = Date.now(); for (const [token, preview] of this.previews) if (preview.expiresAt <= now) this.previews.delete(token); }
}

function safeCsv(value: string): string { const safe = /^[=+\-@]/.test(value) ? `'${value}` : value; return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; }
