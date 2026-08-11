import { IsEnum, IsIn } from 'class-validator';
import { OrganizationApplicationStatus } from '@prisma/client';

export class UpdateOrganizationApplicationStatusDto {
  @IsEnum(OrganizationApplicationStatus)
  @IsIn([OrganizationApplicationStatus.APPROVED, OrganizationApplicationStatus.SUSPENDED])
  status!: OrganizationApplicationStatus;
}
