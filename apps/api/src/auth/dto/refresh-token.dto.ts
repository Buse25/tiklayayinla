import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Giriş veya önceki yenileme işleminden alınan refresh token' })
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  refreshToken!: string;
}
