import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationApplicationStatus, OrganizationType } from '@prisma/client';

export class OrganizationApplicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() organizationName!: string;
  @ApiProperty({ enum: OrganizationType }) organizationType!: OrganizationType;
  @ApiProperty() country!: string;
  @ApiProperty() city!: string;
  @ApiProperty() district!: string;
  @ApiPropertyOptional() taxOffice!: string | null;
  @ApiPropertyOptional() vkn!: string | null;
  @ApiProperty() authorizedPersonName!: string;
  @ApiPropertyOptional() companyPhone!: string | null;
  @ApiPropertyOptional() businessEmail!: string | null;
  @ApiProperty() address!: string;
  @ApiPropertyOptional() licenseNumber!: string | null;
  @ApiProperty({ enum: OrganizationApplicationStatus }) status!: OrganizationApplicationStatus;
  @ApiPropertyOptional() rejectionReason!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) reviewedById!: string | null;
  @ApiPropertyOptional() reviewedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
