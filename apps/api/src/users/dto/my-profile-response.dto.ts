import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EidsIdentityStatus, EidsVerificationMethod, MembershipStatus, OrganizationApplicationStatus, OrganizationRole, OrganizationType, PhoneVerificationMethod, UserRole, UserStatus } from '@prisma/client';

export class UserCurrentPlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() status!: string;
}

export class MyOrganizationMembershipSummaryDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) organizationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) organizationName!: string | null;
  @ApiPropertyOptional({ enum: OrganizationType, nullable: true }) organizationType!: OrganizationType | null;
  @ApiPropertyOptional({ enum: OrganizationRole, nullable: true }) membershipRole!: OrganizationRole | null;
  @ApiPropertyOptional({ enum: MembershipStatus, nullable: true }) membershipStatus!: MembershipStatus | null;
  @ApiPropertyOptional({ nullable: true }) city!: string | null;
  @ApiPropertyOptional({ nullable: true }) district!: string | null;
  @ApiPropertyOptional({ nullable: true }) address!: string | null;
}

export class EidsProfileStatusDto {
  @ApiProperty() configured!: boolean;
  @ApiProperty({ enum: EidsIdentityStatus }) status!: EidsIdentityStatus;
  @ApiProperty() verified!: boolean;
  @ApiPropertyOptional({ nullable: true }) verifiedAt!: Date | null;
  @ApiPropertyOptional({ enum: EidsVerificationMethod, nullable: true }) verificationMethod!: EidsVerificationMethod | null;
}

export class MyProfileResponseDto {
  @ApiProperty({ example: 'f9c759fe-9e48-4e1f-99f7-8e76e1ed992c' }) id!: string;
  @ApiProperty({ example: 'ayse@example.com' }) email!: string;
  @ApiProperty({ example: 'Ayşe' }) firstName!: string;
  @ApiProperty({ example: 'Yılmaz' }) lastName!: string;
  @ApiPropertyOptional({ example: '+905551112233', nullable: true }) phone!: string | null;
  @ApiProperty() emailVerified!: boolean;
  @ApiPropertyOptional({ nullable: true }) emailVerifiedAt!: Date | null;
  @ApiProperty() phoneVerified!: boolean;
  @ApiPropertyOptional({ nullable: true }) phoneVerifiedAt!: Date | null;
  @ApiPropertyOptional({ enum: PhoneVerificationMethod, nullable: true }) phoneVerificationMethod!: PhoneVerificationMethod | null;
  @ApiProperty({ type: EidsProfileStatusDto }) eids!: EidsProfileStatusDto;
  @ApiPropertyOptional({ nullable: true }) about!: string | null;
  @ApiPropertyOptional({ nullable: true }) address!: string | null;
  @ApiProperty({ enum: UserRole, example: UserRole.USER }) role!: UserRole;
  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE }) status!: UserStatus;
  @ApiProperty({ example: '2026-08-04T10:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2026-08-04T10:15:00.000Z' }) updatedAt!: Date;
  @ApiProperty({ type: MyOrganizationMembershipSummaryDto }) organization!: MyOrganizationMembershipSummaryDto;
  @ApiPropertyOptional({ enum: OrganizationApplicationStatus, nullable: true }) organizationApplicationStatus!: OrganizationApplicationStatus | null;
  @ApiPropertyOptional({ type: UserCurrentPlanDto, nullable: true }) currentPlan?: UserCurrentPlanDto | null;
}
