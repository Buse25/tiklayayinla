import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus, ListingType, PropertyType } from '@prisma/client';

export class ListListingsQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @ApiPropertyOptional({ enum: ListingStatus }) @IsOptional() @IsEnum(ListingStatus) status?: ListingStatus;
  @ApiPropertyOptional({ enum: ListingType }) @IsOptional() @IsEnum(ListingType) listingType?: ListingType;
  @ApiPropertyOptional({ enum: PropertyType }) @IsOptional() @IsEnum(PropertyType) propertyType?: PropertyType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional({ description: 'Başlık ve açıklama içinde aranır' }) @IsOptional() @IsString() @MaxLength(200) search?: string;
  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'price', 'title'], default: 'createdAt' }) @IsOptional() @IsIn(['createdAt', 'updatedAt', 'price', 'title']) sortBy: 'createdAt' | 'updatedAt' | 'price' | 'title' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' }) @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}
