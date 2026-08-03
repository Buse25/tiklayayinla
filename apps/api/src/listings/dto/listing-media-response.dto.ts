import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingMediaType } from '@prisma/client';

export class ListingMediaResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() listingId!: string;
  @ApiProperty({ enum: ListingMediaType }) type!: ListingMediaType;
  @ApiProperty() url!: string;
  @ApiProperty() storageKey!: string;
  @ApiPropertyOptional() originalName!: string | null;
  @ApiProperty() mimeType!: string;
  @ApiProperty() fileSize!: number;
  @ApiPropertyOptional() width!: number | null;
  @ApiPropertyOptional() height!: number | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isCover!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
