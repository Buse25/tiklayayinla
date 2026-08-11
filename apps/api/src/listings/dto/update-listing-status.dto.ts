import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ListingStatus } from '@prisma/client';

export class UpdateListingStatusDto {
  @ApiProperty({ enum: [ListingStatus.DRAFT, ListingStatus.ACTIVE, ListingStatus.SUSPENDED, ListingStatus.ARCHIVED], example: ListingStatus.SUSPENDED })
  @IsEnum(ListingStatus)
  status!: ListingStatus;
}
