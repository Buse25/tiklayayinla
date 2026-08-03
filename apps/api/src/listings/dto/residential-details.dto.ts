import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdvertiserType, EnergyCertificate, HeatingType, HousingType, KitchenType, OccupancyStatus, ParkingType, TitleDeedStatus } from '@prisma/client';

export class ResidentialDetailsDto {
  @ApiPropertyOptional({ example: 110 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(1_000_000) grossArea?: number;
  @ApiPropertyOptional({ example: 90 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(1_000_000) netArea?: number;
  @ApiPropertyOptional({ example: '2+1' }) @IsOptional() @IsString() @MaxLength(30) roomCount?: string;
  @ApiPropertyOptional({ example: 5 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(200) buildingAge?: number;
  @ApiPropertyOptional({ example: 3 }) @IsOptional() @Type(() => Number) @IsInt() @Min(-10) @Max(300) floorNumber?: number;
  @ApiPropertyOptional({ example: 8 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(300) totalFloors?: number;
  @ApiPropertyOptional({ enum: HeatingType }) @IsOptional() @IsEnum(HeatingType) heatingType?: HeatingType;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) bathroomCount?: number;
  @ApiPropertyOptional({ enum: KitchenType }) @IsOptional() @IsEnum(KitchenType) kitchenType?: KitchenType;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasBalcony?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasElevator?: boolean;
  @ApiPropertyOptional({ enum: ParkingType }) @IsOptional() @IsEnum(ParkingType) parkingType?: ParkingType;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFurnished?: boolean;
  @ApiPropertyOptional({ enum: OccupancyStatus }) @IsOptional() @IsEnum(OccupancyStatus) occupancyStatus?: OccupancyStatus;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isInComplex?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) complexName?: string;
  @ApiPropertyOptional({ example: 2500 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) monthlyFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCreditEligible?: boolean;
  @ApiPropertyOptional({ enum: EnergyCertificate }) @IsOptional() @IsEnum(EnergyCertificate) energyCertificate?: EnergyCertificate;
  @ApiPropertyOptional({ enum: TitleDeedStatus }) @IsOptional() @IsEnum(TitleDeedStatus) titleDeedStatus?: TitleDeedStatus;
  @ApiPropertyOptional({ enum: AdvertiserType }) @IsOptional() @IsEnum(AdvertiserType) advertiserType?: AdvertiserType;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isExchangeAccepted?: boolean;
  @ApiPropertyOptional({ enum: HousingType }) @IsOptional() @IsEnum(HousingType) housingType?: HousingType;
}
