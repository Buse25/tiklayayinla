import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum, IsIn, IsUUID } from 'class-validator';

class BulkListingIdsDto {
  @ApiProperty({ type: [String], example: ['4e496765-e53a-4fe2-84bc-5f0695d56d9e'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  listingIds!: string[];
}

export class BulkListingStatusDto extends BulkListingIdsDto {
  @ApiProperty({ enum: [ListingStatus.ARCHIVED, ListingStatus.DRAFT], example: ListingStatus.ARCHIVED })
  @IsEnum(ListingStatus)
  @IsIn([ListingStatus.ARCHIVED, ListingStatus.DRAFT])
  status!: ListingStatus;
}

export class BulkPublishListingsDto extends BulkListingIdsDto {
  @ApiProperty({ type: [String], example: ['4e496765-e53a-4fe2-84bc-5f0695d56d9e'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  portalAccountIds!: string[];
}

export class BulkRepublishListingsDto extends BulkListingIdsDto {}

export class BulkListingResultDto {
  @ApiProperty() listingId!: string;
  @ApiProperty() success!: boolean;
  @ApiPropertyOptional({ enum: ListingStatus }) status?: ListingStatus;
  @ApiPropertyOptional() jobsCreated?: number;
  @ApiPropertyOptional() errorCode?: string;
  @ApiPropertyOptional() message?: string;
}

export class BulkListingsResponseDto {
  @ApiProperty() requested!: number;
  @ApiProperty() successful!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() jobsCreated!: number;
  @ApiProperty({ type: [BulkListingResultDto] }) results!: BulkListingResultDto[];
}
