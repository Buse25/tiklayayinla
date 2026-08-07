import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus, OrganizationApplicationStatus, OrganizationRole, OrganizationType, UserRole, UserStatus } from '@prisma/client';

export class OrganizationMembershipSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: OrganizationType }) type!: OrganizationType;
  @ApiProperty({ enum: OrganizationRole }) membershipRole!: OrganizationRole;
  @ApiProperty({ enum: MembershipStatus }) membershipStatus!: MembershipStatus;
}

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional({ type: OrganizationMembershipSummaryDto, nullable: true }) organization!: OrganizationMembershipSummaryDto | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) organizationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) organizationName!: string | null;
  @ApiPropertyOptional({ enum: OrganizationType, nullable: true }) organizationType!: OrganizationType | null;
  @ApiPropertyOptional({ enum: OrganizationRole, nullable: true }) membershipRole!: OrganizationRole | null;
  @ApiPropertyOptional({ enum: MembershipStatus, nullable: true }) membershipStatus!: MembershipStatus | null;
  @ApiPropertyOptional({ enum: OrganizationApplicationStatus, nullable: true }) organizationApplicationStatus!: OrganizationApplicationStatus | null;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
}
