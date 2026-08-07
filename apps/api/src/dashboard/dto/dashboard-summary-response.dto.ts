import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardListingsSummaryDto {
  @ApiProperty() total!: number;
  @ApiProperty() draft!: number;
  @ApiProperty() publishing!: number;
  @ApiProperty() active!: number;
  @ApiProperty() archived!: number;
  @ApiProperty() createdToday!: number;
  @ApiProperty() createdLast7Days!: number;
  @ApiProperty() createdLast30Days!: number;
}

export class DashboardPortalAccountsSummaryDto {
  @ApiProperty() total!: number;
  @ApiProperty() connected!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() notTested!: number;
  @ApiProperty() totalActivePortals!: number;
}

export class DashboardPublicationsSummaryDto {
  @ApiProperty() total!: number;
  @ApiProperty() queued!: number;
  @ApiProperty() processing!: number;
  @ApiProperty() published!: number;
  @ApiProperty() failed!: number;
}

export class RecentPublicationDto {
  @ApiProperty() publicationId!: string;
  @ApiProperty() listingId!: string;
  @ApiProperty() listingTitle!: string;
  @ApiProperty() portalName!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) externalUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) publishedAt!: Date | null;
  @ApiProperty() updatedAt!: Date;
}

export class RecentPublicationErrorDto {
  @ApiProperty() publicationId!: string;
  @ApiProperty() listingId!: string;
  @ApiProperty() listingTitle!: string;
  @ApiProperty() portalName!: string;
  @ApiPropertyOptional({ nullable: true }) lastError!: string | null;
  @ApiProperty() updatedAt!: Date;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ type: DashboardListingsSummaryDto }) listings!: DashboardListingsSummaryDto;
  @ApiProperty({ type: DashboardPortalAccountsSummaryDto }) portalAccounts!: DashboardPortalAccountsSummaryDto;
  @ApiProperty({ type: DashboardPublicationsSummaryDto }) publications!: DashboardPublicationsSummaryDto;
  @ApiProperty({ type: [RecentPublicationDto] }) recentPublications!: RecentPublicationDto[];
  @ApiProperty({ type: [RecentPublicationErrorDto] }) recentErrors!: RecentPublicationErrorDto[];
}
