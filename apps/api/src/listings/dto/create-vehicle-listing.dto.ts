import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, FuelType, ListingType, TransmissionType, VehicleBodyType } from '@prisma/client';

export class CreateVehicleListingDto {
  @ApiProperty({ example: 'Sahibinden temiz BMW 320i Sedan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: 'Kazasız, tramersiz, bakımları yetkili serviste yapılmış temiz araç.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(10_000)
  description!: string;

  @ApiProperty({ example: 1450000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @ApiProperty({ enum: Currency, example: Currency.TRY })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty({ enum: ListingType, example: ListingType.SALE })
  @IsEnum(ListingType)
  listingType!: ListingType;

  @ApiProperty({ example: 'BMW' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  brand!: string;

  @ApiProperty({ example: '320i' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model!: string;

  @ApiProperty({ example: 2020 })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2027)
  year!: number;

  @ApiProperty({ example: 85000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mileage!: number;

  @ApiProperty({ enum: FuelType, example: FuelType.GASOLINE })
  @IsEnum(FuelType)
  fuelType!: FuelType;

  @ApiProperty({ enum: TransmissionType, example: TransmissionType.AUTOMATIC })
  @IsEnum(TransmissionType)
  transmission!: TransmissionType;

  @ApiPropertyOptional({ enum: VehicleBodyType, example: VehicleBodyType.SEDAN })
  @IsOptional()
  @IsEnum(VehicleBodyType)
  bodyType?: VehicleBodyType;

  @ApiPropertyOptional({ example: 170 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  enginePower?: number;

  @ApiPropertyOptional({ example: 1598 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  engineVolume?: number;

  @ApiPropertyOptional({ example: 'Metalik Gri' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ example: 'Orijinal, boyasız' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  damageStatus?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasWarranty?: boolean;

  @ApiProperty({ example: 'İstanbul' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Kadıköy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @ApiPropertyOptional({ example: 'Moda' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;

  @ApiProperty({ example: 'Moda Caddesi No: 15' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}
