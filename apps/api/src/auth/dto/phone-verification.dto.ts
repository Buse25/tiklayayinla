import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyPhoneDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Doğrulama kodu 6 haneli olmalıdır.' })
  code!: string;
}

export class PhoneVerificationResponseDto {
  @ApiProperty() accepted!: boolean;
  @ApiProperty() phone!: string;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty() resendAvailableAt!: Date;
}
