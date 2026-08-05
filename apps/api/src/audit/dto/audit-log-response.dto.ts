import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, AuditEntityType, UserRole } from '@prisma/client';

export class AuditActorResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
}

export class AuditLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'uuid' }) actorUserId!: string;
  @ApiPropertyOptional({ type: AuditActorResponseDto, nullable: true }) actor!: AuditActorResponseDto | null;
  @ApiProperty({ enum: AuditAction }) action!: AuditAction;
  @ApiProperty({ enum: AuditEntityType }) entityType!: AuditEntityType;
  @ApiProperty({ format: 'uuid' }) entityId!: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) changes!: Record<string, unknown> | null;
  @ApiPropertyOptional() ipAddress!: string | null;
  @ApiPropertyOptional() userAgent!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class AuditLogsPageResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] }) data!: AuditLogResponseDto[];
  @ApiProperty({ example: { page: 1, limit: 20, total: 0, totalPages: 0 } }) pagination!: { page: number; limit: number; total: number; totalPages: number };
}
