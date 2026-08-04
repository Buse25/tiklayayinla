import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportMappingItemDto {
  @ApiProperty() @IsString() sourceField!: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() targetField?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() transformation?: string | null;
}

export class TransformImportDto {
  @ApiProperty() @IsString() analysisToken!: string;
  @ApiProperty({ type: [ImportMappingItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => ImportMappingItemDto) mapping!: ImportMappingItemDto[];
}
