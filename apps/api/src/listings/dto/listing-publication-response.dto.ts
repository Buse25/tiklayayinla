import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListingPublicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() portalName!: string;
  @ApiPropertyOptional({ nullable: true }) portalAccountId!: string | null;
  @ApiProperty() accountName!: string;
  @ApiProperty({ enum: ['QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED'] }) status!: string;
  @ApiPropertyOptional({ nullable: true }) externalUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastError!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastAttemptAt!: Date | null;
  @ApiProperty() updatedAt!: Date;
}
