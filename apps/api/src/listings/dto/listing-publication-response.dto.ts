import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';

export class ListingPublicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() portalName!: string;
  @ApiPropertyOptional({ nullable: true }) portalAccountId!: string | null;
  @ApiProperty() accountName!: string;
  @ApiProperty({ enum: PublicationStatus }) status!: PublicationStatus;
  @ApiPropertyOptional({ nullable: true }) externalUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastError!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastAttemptAt!: Date | null;
  @ApiProperty() updatedAt!: Date;
}
