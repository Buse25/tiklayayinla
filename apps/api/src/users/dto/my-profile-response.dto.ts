import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class MyProfileResponseDto {
  @ApiProperty({ example: 'f9c759fe-9e48-4e1f-99f7-8e76e1ed992c' }) id!: string;
  @ApiProperty({ example: 'ayse@example.com' }) email!: string;
  @ApiProperty({ example: 'Ayşe' }) firstName!: string;
  @ApiProperty({ example: 'Yılmaz' }) lastName!: string;
  @ApiPropertyOptional({ example: '+905551112233', nullable: true }) phone!: string | null;
  @ApiProperty({ enum: UserRole, example: UserRole.AGENT }) role!: UserRole;
  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE }) status!: UserStatus;
  @ApiProperty({ example: '2026-08-04T10:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2026-08-04T10:15:00.000Z' }) updatedAt!: Date;
}
