import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RegisterOrganizationDto } from './register-organization.dto';

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
  @Length(2, 50)
  firstName!: string;

  @ApiProperty({ example: 'Yılmaz' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  lastName!: string;

  @ApiPropertyOptional({ example: '+905551112233', nullable: true, maxLength: 30 })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ type: RegisterOrganizationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterOrganizationDto)
  organization?: RegisterOrganizationDto;
}
