import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ListingStatus } from '@prisma/client';

export class UpdateListingStatusDto {
  @ApiProperty({ enum: [ListingStatus.DRAFT, ListingStatus.ARCHIVED], example: ListingStatus.ARCHIVED })
  @IsEnum(ListingStatus)
  status!: ListingStatus;
}
