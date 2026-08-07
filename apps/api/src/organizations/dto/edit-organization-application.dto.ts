import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { OrganizationType } from '@prisma/client';

export class EditOrganizationApplicationDto {
  @ApiPropertyOptional({ example: 'Yılmaz Gayrimenkul', minLength: 2, maxLength: 150 })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 150)
  organizationName?: string;

  @ApiPropertyOptional({ enum: OrganizationType, example: OrganizationType.REAL_ESTATE_AGENCY })
  @IsOptional()
  @IsEnum(OrganizationType)
  organizationType?: OrganizationType;

  @ApiPropertyOptional({ example: 'Türkiye' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: 'Bursa' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Osmangazi' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({ example: 'Çekirge Mah. Atatürk Cad. No: 10' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'Bursa Vergi Dairesi', nullable: true })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(120)
  taxOffice?: string | null;

  @ApiPropertyOptional({ example: '1234567890', nullable: true })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(20)
  vkn?: string | null;

  @ApiPropertyOptional({ example: 'Ahmet Yılmaz' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(150)
  authorizedPersonName?: string;

  @ApiPropertyOptional({ example: '+902242221122', nullable: true })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(30)
  companyPhone?: string | null;

  @ApiPropertyOptional({ example: 'kurumsal@firma.com', nullable: true })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsEmail()
  businessEmail?: string | null;

  @ApiPropertyOptional({ example: 'EIDS-YETKI-2026-001', nullable: true, description: 'Sadece AUTO_DEALER için zorunludur.' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(80)
  licenseNumber?: string | null;
}
