import { BadRequestException, Injectable } from '@nestjs/common';
import { FieldMappingService } from './field-mapping.service';
import { SourceFileAnalyzerService } from './source-file-analyzer.service';
import { ImportAnalysisStoreService } from './import-analysis-store.service';
import { ValueNormalizerService } from './value-normalizer.service';
import type { ImportAnalysisResponseDto } from './dto/analyze-import.dto';
import type { TransformImportDto } from './dto/transform-import.dto';
import { ListingImportService } from '../listing-import.service';

const required = ['title', 'description', 'price', 'currency', 'listing_type', 'property_type', 'city', 'district', 'address'];
const allowedTargets = new Set(['title', 'description', 'price', 'currency', 'listing_type', 'property_type', 'city', 'district', 'neighborhood', 'address', 'latitude', 'longitude', 'gross_area', 'net_area', 'room_count', 'building_age', 'floor_number', 'total_floors', 'heating_type', 'bathroom_count', 'kitchen_type', 'has_balcony', 'has_elevator', 'parking_type', 'is_furnished', 'occupancy_status', 'is_in_complex', 'complex_name', 'monthly_fee', 'is_credit_eligible', 'energy_certificate', 'title_deed_status', 'advertiser_type', 'is_exchange_accepted', 'housing_type', 'facades', 'interior_features', 'exterior_features', 'nearby_places', 'transportation', 'views', 'accessibility_features']);

@Injectable()
export class ListingImportMappingService {
  constructor(private readonly analyzer: SourceFileAnalyzerService, private readonly mappings: FieldMappingService, private readonly store: ImportAnalysisStoreService, private readonly normalizer: ValueNormalizerService, private readonly imports: ListingImportService) {}

  analyze(userId: string, file: Express.Multer.File): ImportAnalysisResponseDto {
    const source = this.analyzer.analyze(file);
    const fields = source.fields.map((sourceField) => this.mappings.suggest(sourceField, source.rows.map((row) => row.values[sourceField]).filter(Boolean).slice(0, 5)));
    const delimiterWarning = source.sourceType === 'CSV' && source.delimiter !== ';' ? [`${source.delimiter === '\t' ? 'Tab' : source.delimiter} ayırıcı tespit edildi; transform standart alanlara dönüştürecek.`] : [];
    return { analysisToken: this.store.create(userId, source.fields, source.rows), sourceType: source.sourceType, totalRows: source.rows.length, fields, requiredTargetsMissing: this.mappings.requiredMissing(fields), warnings: [...source.warnings, ...delimiterWarning] };
  }

  async transform(userId: string, dto: TransformImportDto) {
    const analysis = this.store.get(userId, dto.analysisToken); const targetFields = new Set<string>();
    for (const item of dto.mapping) { if (!analysis.fields.includes(item.sourceField)) throw new BadRequestException(`Kaynak alan bulunamadı: ${item.sourceField}.`); if (!item.targetField) continue; if (!allowedTargets.has(item.targetField)) throw new BadRequestException(`Hedef alan geçersiz: ${item.targetField}.`); if (targetFields.has(item.targetField)) throw new BadRequestException(`Aynı hedef alan iki kez eşlenemez: ${item.targetField}.`); targetFields.add(item.targetField); }
    const missing = required.filter((field) => !targetFields.has(field)); if (missing.length) throw new BadRequestException(`Zorunlu hedef alanlar eşlenmedi: ${missing.join(', ')}.`);
    const rows = analysis.rows.map((source) => { const values: Record<string, string> = {}; for (const item of dto.mapping) if (item.targetField) Object.assign(values, this.normalizer.transform(item.targetField, source.values[item.sourceField] ?? '')); return { row: source.row, values }; });
    return this.imports.previewRows(userId, rows);
  }
}
