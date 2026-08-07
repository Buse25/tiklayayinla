import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class VerificationRequiredResponseDto {
  @ApiProperty({ example: true }) verificationRequired!: true;
  @ApiProperty({ example: 'a***@example.com' }) email!: string;
  @ApiPropertyOptional({ example: '2026-08-06T12:10:00.000Z', nullable: true }) expiresAt!: Date | null;
  @ApiPropertyOptional({ example: '2026-08-06T12:01:00.000Z', nullable: true }) resendAvailableAt!: Date | null;
  @ApiPropertyOptional({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }) verificationContext?: string;
  @ApiPropertyOptional({ example: false }) mailDeliveryFailed?: boolean;
}

export class VerificationStatusResponseDto {
  @ApiProperty({ example: false }) emailVerified!: boolean;
  @ApiPropertyOptional({ example: '2026-08-06T12:10:00.000Z', nullable: true }) expiresAt!: Date | null;
  @ApiPropertyOptional({ example: '2026-08-06T12:01:00.000Z', nullable: true }) resendAvailableAt!: Date | null;
  @ApiProperty({ example: 5 }) attemptsRemaining!: number;
  @ApiPropertyOptional({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }) verificationContext?: string;
}

export class VerificationActionResponseDto {
  @ApiProperty({ example: true }) accepted!: boolean;
  @ApiPropertyOptional({ example: '2026-08-06T12:10:00.000Z', nullable: true }) expiresAt!: Date | null;
  @ApiPropertyOptional({ example: '2026-08-06T12:01:00.000Z', nullable: true }) resendAvailableAt!: Date | null;
  @ApiPropertyOptional({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }) verificationContext?: string;
  @ApiPropertyOptional({ example: false }) mailDeliveryFailed?: boolean;
}

export class VerifyEmailDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'eyJhbGciOi...' })
  @IsOptional()
  @IsString()
  verificationContext?: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendVerificationDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'eyJhbGciOi...' })
  @IsOptional()
  @IsString()
  verificationContext?: string;
}
