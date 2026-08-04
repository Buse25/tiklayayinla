import { ApiProperty } from '@nestjs/swagger';

export class ImportFieldSuggestionDto {
  @ApiProperty() sourceField!: string;
  @ApiProperty({ enum: ['string', 'number', 'unknown'], example: 'string' }) dataType!: 'string' | 'number' | 'unknown';
  @ApiProperty({ type: [String] }) sampleValues!: string[];
  @ApiProperty({ nullable: true }) suggestedTarget!: string | null;
  @ApiProperty() confidence!: number;
  @ApiProperty({ nullable: true }) transformation!: string | null;
  @ApiProperty() reason!: string;
}

export class ImportAnalysisResponseDto {
  @ApiProperty() analysisToken!: string;
  @ApiProperty({ enum: ['CSV', 'JSON'], example: 'JSON' }) sourceType!: 'CSV' | 'JSON';
  @ApiProperty() totalRows!: number;
  @ApiProperty({ type: [ImportFieldSuggestionDto] }) fields!: ImportFieldSuggestionDto[];
  @ApiProperty({ type: [String] }) requiredTargetsMissing!: string[];
  @ApiProperty({ type: [String] }) warnings!: string[];
}
