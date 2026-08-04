import { BadRequestException, Injectable } from '@nestjs/common';
import { CsvSourceAnalyzerService } from './csv-source-analyzer.service';
import { JsonSourceAnalyzerService } from './json-source-analyzer.service';
import type { SourceDataset } from './source-dataset';

@Injectable()
export class SourceFileAnalyzerService {
  constructor(private readonly csv: CsvSourceAnalyzerService, private readonly json: JsonSourceAnalyzerService) {}

  analyze(file: Express.Multer.File): SourceDataset {
    const name = file?.originalname?.toLowerCase() ?? '';
    if (name.endsWith('.csv')) return this.csv.analyze(file);
    if (name.endsWith('.json')) return this.json.analyze(file);
    throw new BadRequestException('Yalnızca .csv veya .json dosyası yüklenebilir.');
  }
}
