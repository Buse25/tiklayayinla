import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ListingImportConfirmDto {
  @ApiProperty() @IsString() @IsNotEmpty() previewToken!: string;
}

export class ListingImportErrorDto {
  @ApiProperty() row!: number;
  @ApiProperty() column!: string;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ nullable: true }) value!: string | null;
}

export class ListingImportPreviewRowDto {
  @ApiProperty() row!: number;
  @ApiProperty() title!: string;
  @ApiProperty() city!: string;
  @ApiProperty() district!: string;
  @ApiProperty() price!: number;
  @ApiProperty() currency!: string;
}

export class ListingImportPreviewResponseDto {
  @ApiProperty() previewToken!: string;
  @ApiProperty() summary!: { totalRows: number; validRows: number; invalidRows: number; duplicateRows: number };
  @ApiProperty({ type: [ListingImportPreviewRowDto] }) validRows!: ListingImportPreviewRowDto[];
  @ApiProperty({ type: [ListingImportErrorDto] }) errors!: ListingImportErrorDto[];
}

export class ListingImportConfirmResponseDto {
  @ApiProperty() summary!: { totalRows: number; createdRows: number; failedRows: number; skippedRows: number };
  @ApiProperty() createdListings!: Array<{ row: number; id: string; listingNo: string }>;
  @ApiProperty({ type: [ListingImportErrorDto] }) errors!: ListingImportErrorDto[];
}
