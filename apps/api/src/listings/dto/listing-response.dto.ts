import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdvertiserType, Currency, EnergyCertificate, HeatingType, HousingType, KitchenType, ListingMediaType, ListingStatus, ListingType, OccupancyStatus, ParkingType, PropertyType, PublicationStatus, TitleDeedStatus, ListingDomain, FuelType, TransmissionType, VehicleBodyType } from '@prisma/client';

export class ListingMediaResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ListingMediaType }) type!: ListingMediaType;
  @ApiProperty() url!: string;
  @ApiProperty() sortOrder!: number;
}

export class ListingPublicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PublicationStatus }) status!: PublicationStatus;
  @ApiPropertyOptional() externalListingId!: string | null;
  @ApiPropertyOptional() externalUrl!: string | null;
  @ApiPropertyOptional() lastError!: string | null;
  @ApiPropertyOptional() publishedAt!: Date | null;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ example: { id: 'uuid', code: 'mock-rest', name: 'Mock REST Portal' } }) portal!: { id: string; code: string; name: string };
}

export class VehicleDetailsResponseDto {
  @ApiProperty() listingId!: string;
  @ApiProperty() brand!: string;
  @ApiProperty() model!: string;
  @ApiProperty() year!: number;
  @ApiProperty() mileage!: number;
  @ApiProperty({ enum: FuelType }) fuelType!: FuelType;
  @ApiProperty({ enum: TransmissionType }) transmission!: TransmissionType;
  @ApiPropertyOptional({ enum: VehicleBodyType }) bodyType!: VehicleBodyType | null;
  @ApiPropertyOptional() enginePower!: number | null;
  @ApiPropertyOptional() engineVolume!: number | null;
  @ApiPropertyOptional() color!: string | null;
  @ApiPropertyOptional() damageStatus!: string | null;
  @ApiPropertyOptional() hasWarranty!: boolean | null;
}

export class ListingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'TL-1A2B3C4D5E6F' }) listingNo!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: 4750000 }) price!: number;
  @ApiProperty({ enum: Currency }) currency!: Currency;
  @ApiProperty({ enum: ListingType }) listingType!: ListingType;
  @ApiPropertyOptional({ enum: PropertyType }) propertyType!: PropertyType | null;
  @ApiProperty({ enum: ListingDomain }) listingDomain!: ListingDomain;
  @ApiProperty() city!: string;
  @ApiProperty() district!: string;
  @ApiPropertyOptional() neighborhood!: string | null;
  @ApiProperty() address!: string;
  @ApiPropertyOptional() latitude!: number | null;
  @ApiPropertyOptional() longitude!: number | null;
  @ApiProperty({ enum: ListingStatus }) status!: ListingStatus;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: [ListingMediaResponseDto] }) media!: ListingMediaResponseDto[];
  @ApiProperty({ type: [ListingPublicationResponseDto] }) publications!: ListingPublicationResponseDto[];
  @ApiPropertyOptional({ type: () => ResidentialDetailsResponseDto }) residentialDetails!: Record<string, unknown> | null;
  @ApiPropertyOptional({ type: () => VehicleDetailsResponseDto }) vehicleDetails!: Record<string, unknown> | null;
  @ApiProperty({ type: () => ListingFeaturesResponseDto }) features!: Record<string, FeatureResponseDto[]>;
}

export class ResidentialDetailsResponseDto {
  @ApiProperty() listingId!: string;
  @ApiPropertyOptional() grossArea!: number | null;
  @ApiPropertyOptional() netArea!: number | null;
  @ApiPropertyOptional() roomCount!: string | null;
  @ApiPropertyOptional() buildingAge!: number | null;
  @ApiPropertyOptional() floorNumber!: number | null;
  @ApiPropertyOptional() totalFloors!: number | null;
  @ApiPropertyOptional({ enum: HeatingType }) heatingType!: HeatingType | null;
  @ApiPropertyOptional() bathroomCount!: number | null;
  @ApiPropertyOptional({ enum: KitchenType }) kitchenType!: KitchenType | null;
  @ApiPropertyOptional() hasBalcony!: boolean | null;
  @ApiPropertyOptional() hasElevator!: boolean | null;
  @ApiPropertyOptional({ enum: ParkingType }) parkingType!: ParkingType | null;
  @ApiPropertyOptional() isFurnished!: boolean | null;
  @ApiPropertyOptional({ enum: OccupancyStatus }) occupancyStatus!: OccupancyStatus | null;
  @ApiPropertyOptional() isInComplex!: boolean | null;
  @ApiPropertyOptional() complexName!: string | null;
  @ApiPropertyOptional() monthlyFee!: number | null;
  @ApiPropertyOptional() isCreditEligible!: boolean | null;
  @ApiPropertyOptional({ enum: EnergyCertificate }) energyCertificate!: EnergyCertificate | null;
  @ApiPropertyOptional({ enum: TitleDeedStatus }) titleDeedStatus!: TitleDeedStatus | null;
  @ApiPropertyOptional({ enum: AdvertiserType }) advertiserType!: AdvertiserType | null;
  @ApiPropertyOptional() isExchangeAccepted!: boolean | null;
  @ApiPropertyOptional({ enum: HousingType }) housingType!: HousingType | null;
}

export class FeatureResponseDto { @ApiProperty() code!: string; @ApiProperty() label!: string; }
export class ListingFeaturesResponseDto {
  @ApiProperty({ type: [FeatureResponseDto] }) facades!: FeatureResponseDto[];
  @ApiProperty({ type: [FeatureResponseDto] }) interiorFeatures!: FeatureResponseDto[];
  @ApiProperty({ type: [FeatureResponseDto] }) exteriorFeatures!: FeatureResponseDto[];
  @ApiProperty({ type: [FeatureResponseDto] }) nearbyPlaces!: FeatureResponseDto[];
  @ApiProperty({ type: [FeatureResponseDto] }) transportation!: FeatureResponseDto[];
  @ApiProperty({ type: [FeatureResponseDto] }) views!: FeatureResponseDto[];
  @ApiProperty({ type: [FeatureResponseDto] }) accessibilityFeatures!: FeatureResponseDto[];
}

export class ListingsPageResponseDto {
  @ApiProperty({ type: [ListingResponseDto] }) data!: ListingResponseDto[];
  @ApiProperty({ example: { page: 1, limit: 20, total: 0, totalPages: 0 } }) pagination!: { page: number; limit: number; total: number; totalPages: number };
}
