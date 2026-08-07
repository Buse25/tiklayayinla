import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { OrganizationType } from '@prisma/client';

export class CreateOrganizationApplicationDto {
  @ApiProperty({ example: 'Yılmaz Gayrimenkul', minLength: 2, maxLength: 150 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 150)
  organizationName!: string;

  @ApiProperty({ enum: OrganizationType, example: OrganizationType.REAL_ESTATE_AGENCY })
  @IsEnum(OrganizationType)
  organizationType!: OrganizationType;

  @ApiProperty({ example: 'Türkiye' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country!: string;

  @ApiProperty({ example: 'Bursa' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Osmangazi' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @ApiProperty({ example: 'Çekirge Mah. Atatürk Cad. No: 10' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ example: 'Bursa Vergi Dairesi', required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(120)
  taxOffice?: string | null;

  @ApiProperty({ example: '1234567890', required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(20)
  vkn?: string | null;

  @ApiProperty({ example: 'Ahmet Yılmaz' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  authorizedPersonName!: string;

  @ApiProperty({ example: '+902242221122', required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(30)
  companyPhone?: string | null;

  @ApiProperty({ example: 'kurumsal@firma.com', required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsEmail()
  businessEmail?: string | null;

  @ApiProperty({ example: 'EIDS-YETKI-2026-001', required: false, description: 'Sadece AUTO_DEALER için zorunludur.' })
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @ValidateIf(({ organizationType }) => organizationType === OrganizationType.AUTO_DEALER)
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string | null;
}
