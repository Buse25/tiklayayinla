import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';

export class CreateUserPortalAccountDto {
  @ApiProperty({ example: 'mock-rest' }) @IsString() @IsNotEmpty() @MaxLength(100) portalCode!: string;
  @ApiProperty({ example: { apiKey: 'test-api-key', officeId: 'office-001' }, additionalProperties: true }) @IsObject() @IsNotEmpty() credentials!: Record<string, unknown>;
}
