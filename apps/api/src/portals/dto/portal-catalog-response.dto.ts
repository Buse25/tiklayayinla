import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalCredentialFieldDto {
  @ApiProperty({ example: 'apiKey' }) key!: string;
  @ApiProperty({ example: 'API Anahtarı' }) label!: string;
  @ApiProperty({ enum: ['text', 'password'], example: 'password' }) type!: 'text' | 'password';
  @ApiProperty({ example: true }) required!: boolean;
}

export class PortalCredentialSchemaDto {
  @ApiProperty({ type: [PortalCredentialFieldDto] }) fields!: PortalCredentialFieldDto[];
}

export class PortalCatalogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'mock-rest' }) code!: string;
  @ApiProperty({ example: 'Mock REST Portal' }) name!: string;
  @ApiProperty({ example: 'mock-rest' }) adapterKey!: string;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: 'REST_API' }) connectionType!: string;
  @ApiProperty({ type: PortalCredentialSchemaDto }) credentialSchema!: PortalCredentialSchemaDto;
  @ApiPropertyOptional({ nullable: true }) documentationUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
}
