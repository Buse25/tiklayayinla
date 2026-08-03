import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class UpdateUserPortalAccountDto {
  @ApiPropertyOptional({ example: { apiKey: 'new-api-key', officeId: 'office-001' }, additionalProperties: true }) @IsOptional() @IsObject() @IsNotEmpty() credentials?: Record<string, unknown>;
}
