import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'ayse@example.com' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  email!: string;

  @ApiProperty({ example: 'GucluParola123!' })
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmalıdır.' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Ayşe' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Yılmaz' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;
}
