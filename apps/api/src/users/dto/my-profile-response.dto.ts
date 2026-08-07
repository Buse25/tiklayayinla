import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus, OrganizationApplicationStatus, OrganizationRole, OrganizationType, UserRole, UserStatus } from '@prisma/client';

export class MyOrganizationMembershipSummaryDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) organizationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) organizationName!: string | null;
  @ApiPropertyOptional({ enum: OrganizationType, nullable: true }) organizationType!: OrganizationType | null;
  @ApiPropertyOptional({ enum: OrganizationRole, nullable: true }) membershipRole!: OrganizationRole | null;
  @ApiPropertyOptional({ enum: MembershipStatus, nullable: true }) membershipStatus!: MembershipStatus | null;
}

export class MyProfileResponseDto {
  @ApiProperty({ example: 'f9c759fe-9e48-4e1f-99f7-8e76e1ed992c' }) id!: string;
  @ApiProperty({ example: 'ayse@example.com' }) email!: string;
  @ApiProperty({ example: 'Ayşe' }) firstName!: string;
  @ApiProperty({ example: 'Yılmaz' }) lastName!: string;
  @ApiPropertyOptional({ example: '+905551112233', nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) about!: string | null;
  @ApiPropertyOptional({ nullable: true }) address!: string | null;
  @ApiProperty({ enum: UserRole, example: UserRole.USER }) role!: UserRole;
  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE }) status!: UserStatus;
  @ApiProperty({ example: '2026-08-04T10:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2026-08-04T10:15:00.000Z' }) updatedAt!: Date;
  @ApiProperty({ type: MyOrganizationMembershipSummaryDto }) organization!: MyOrganizationMembershipSummaryDto;
  @ApiPropertyOptional({ enum: OrganizationApplicationStatus, nullable: true }) organizationApplicationStatus!: OrganizationApplicationStatus | null;
}
