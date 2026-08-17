import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EidsIdentityStatus, EidsVerificationMethod, MembershipStatus, OrganizationApplicationStatus, OrganizationType, PhoneVerificationMethod, UserRole, UserStatus } from '@prisma/client';

export class AdminUserOrganizationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: OrganizationType }) type!: OrganizationType;
  @ApiProperty({ enum: MembershipStatus }) membershipStatus!: MembershipStatus;
}

export class AdminUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() emailVerified!: boolean;
  @ApiPropertyOptional({ nullable: true }) emailVerifiedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiProperty() phoneVerified!: boolean;
  @ApiPropertyOptional({ nullable: true }) phoneVerifiedAt!: Date | null;
  @ApiPropertyOptional({ enum: PhoneVerificationMethod, nullable: true }) phoneVerificationMethod!: PhoneVerificationMethod | null;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional({ enum: OrganizationApplicationStatus, nullable: true }) latestApplicationStatus!: OrganizationApplicationStatus | null;
  @ApiPropertyOptional({ type: AdminUserOrganizationDto, nullable: true }) organization!: AdminUserOrganizationDto | null;
  @ApiProperty({ enum: EidsIdentityStatus }) eidsStatus!: EidsIdentityStatus;
  @ApiPropertyOptional({ enum: EidsVerificationMethod, nullable: true }) eidsVerificationMethod!: EidsVerificationMethod | null;
  @ApiPropertyOptional({ nullable: true }) eidsVerifiedAt!: Date | null;
}
