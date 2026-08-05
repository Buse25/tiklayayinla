import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, AuditEntityType } from '@prisma/client';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @ApiPropertyOptional({ enum: AuditAction }) @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @ApiPropertyOptional({ enum: AuditEntityType }) @IsOptional() @IsEnum(AuditEntityType) entityType?: AuditEntityType;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') entityId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Sadece oturumdaki kullanıcı kimliğiyle eşleştiğinde sonuç döner.' }) @IsOptional() @IsUUID('4') actorUserId?: string;
  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', format: 'date-time' }) @IsOptional() @IsISO8601() dateFrom?: string;
  @ApiPropertyOptional({ example: '2026-08-31T23:59:59.999Z', format: 'date-time' }) @IsOptional() @IsISO8601() dateTo?: string;
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' }) @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}

export class EntityAuditLogsParamsDto {
  @IsEnum(AuditEntityType) entityType!: AuditEntityType;
  @IsUUID('4') entityId!: string;
}
