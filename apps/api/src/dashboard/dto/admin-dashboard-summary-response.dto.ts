import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardSummaryResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() suspended!: number;
  @ApiProperty() draft!: number;
  @ApiProperty() deleted!: number;
  @ApiProperty() applicationPending!: number;
  @ApiProperty() applicationApproved!: number;
  @ApiProperty() applicationSuspended!: number;
  @ApiProperty() applicationRejected!: number;
  @ApiProperty({ type: [Object] }) pendingApplications!: Array<{ id: string; organizationName: string; city: string; district: string; createdAt: Date }>;
}
