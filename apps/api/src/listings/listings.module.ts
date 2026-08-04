import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingMediaController } from './listing-media.controller';
import { ListingMediaService } from './listing-media.service';
import { ListingImportController } from './import/listing-import.controller';
import { ListingImportService } from './import/listing-import.service';
import { CsvListingParserService } from './import/csv-listing-parser.service';
import { CsvListingValidatorService } from './import/csv-listing-validator.service';
import { SourceFileAnalyzerService } from './import/mapping/source-file-analyzer.service';
import { CsvSourceAnalyzerService } from './import/mapping/csv-source-analyzer.service';
import { JsonSourceAnalyzerService } from './import/mapping/json-source-analyzer.service';
import { FieldMappingService } from './import/mapping/field-mapping.service';
import { ValueNormalizerService } from './import/mapping/value-normalizer.service';
import { ImportAnalysisStoreService } from './import/mapping/import-analysis-store.service';
import { ListingImportMappingService } from './import/mapping/listing-import-mapping.service';
import { BulkListingsService } from './bulk-listings.service';

@Module({ controllers: [ListingsController, ListingMediaController, ListingImportController], providers: [ListingsService, BulkListingsService, ListingMediaService, ListingImportService, CsvListingParserService, CsvListingValidatorService, SourceFileAnalyzerService, CsvSourceAnalyzerService, JsonSourceAnalyzerService, FieldMappingService, ValueNormalizerService, ImportAnalysisStoreService, ListingImportMappingService] })
export class ListingsModule {}
