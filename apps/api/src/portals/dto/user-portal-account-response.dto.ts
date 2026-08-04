import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectionStatus } from '@prisma/client';

export class UserPortalAccountResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ConnectionStatus }) connectionStatus!: ConnectionStatus;
  @ApiPropertyOptional() lastCheckedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) lastError!: string | null;
  @ApiProperty({ example: { id: 'uuid', code: 'mock-rest', name: 'Mock REST Portal', adapterKey: 'mock-rest' } }) portal!: { id: string; code: string; name: string; adapterKey: string };
}

export class PortalConnectionTestResponseDto {
  @ApiProperty() connected!: boolean;
  @ApiProperty({ enum: ConnectionStatus }) connectionStatus!: ConnectionStatus;
  @ApiProperty() checkedAt!: Date;
  @ApiPropertyOptional({ nullable: true }) lastError?: string | null;
}
