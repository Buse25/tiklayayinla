import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, ListingType, PropertyType } from '@prisma/client';
import { ResidentialDetailsDto } from './residential-details.dto';

export class CreateListingDto {
  @ApiProperty({ example: 'Kadıköy’de deniz manzaralı 2+1 daire' }) @IsString() @IsNotEmpty() @MinLength(5) @MaxLength(160) title!: string;
  @ApiProperty({ example: 'Merkezi konumda, ulaşımı kolay ve bakımlı daire.' }) @IsString() @IsNotEmpty() @MinLength(20) @MaxLength(10_000) description!: string;
  @ApiProperty({ example: 4750000 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() price!: number;
  @ApiProperty({ enum: Currency, example: Currency.TRY }) @IsEnum(Currency) currency!: Currency;
  @ApiProperty({ enum: ListingType, example: ListingType.SALE }) @IsEnum(ListingType) listingType!: ListingType;
  @ApiProperty({ enum: PropertyType, example: PropertyType.APARTMENT }) @IsEnum(PropertyType) propertyType!: PropertyType;
  @ApiProperty({ example: 'İstanbul' }) @IsString() @IsNotEmpty() @MaxLength(100) city!: string;
  @ApiProperty({ example: 'Kadıköy' }) @IsString() @IsNotEmpty() @MaxLength(100) district!: string;
  @ApiPropertyOptional({ example: 'Caferağa' }) @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @ApiProperty({ example: 'Caferağa Mah. Moda Cad. No: 1' }) @IsString() @IsNotEmpty() @MaxLength(500) address!: string;
  @ApiPropertyOptional({ example: 40.9876 }) @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional({ example: 29.0275 }) @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional({ type: ResidentialDetailsDto }) @IsOptional() @ValidateNested() @Type(() => ResidentialDetailsDto) residentialDetails?: ResidentialDetailsDto;
  @ApiPropertyOptional({ type: [String], example: ['SOUTH', 'EAST'] }) @IsOptional() @IsArray() @IsString({ each: true }) facades?: string[];
  @ApiPropertyOptional({ type: [String], example: ['SMART_HOME'] }) @IsOptional() @IsArray() @IsString({ each: true }) interiorFeatures?: string[];
  @ApiPropertyOptional({ type: [String], example: ['SECURITY'] }) @IsOptional() @IsArray() @IsString({ each: true }) exteriorFeatures?: string[];
  @ApiPropertyOptional({ type: [String], example: ['HOSPITAL'] }) @IsOptional() @IsArray() @IsString({ each: true }) nearbyPlaces?: string[];
  @ApiPropertyOptional({ type: [String], example: ['METRO'] }) @IsOptional() @IsArray() @IsString({ each: true }) transportation?: string[];
  @ApiPropertyOptional({ type: [String], example: ['SEA_VIEW'] }) @IsOptional() @IsArray() @IsString({ each: true }) views?: string[];
  @ApiPropertyOptional({ type: [String], example: ['WHEELCHAIR_ACCESS'] }) @IsOptional() @IsArray() @IsString({ each: true }) accessibilityFeatures?: string[];
}
