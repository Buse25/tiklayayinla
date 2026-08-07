import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PasswordCodeResponseDto {
  @ApiProperty({ example: 'a***e@example.com' }) email!: string;
  @ApiProperty() expiresAt!: Date;
  @ApiPropertyOptional({ nullable: true }) resendAvailableAt!: Date | null;
}
