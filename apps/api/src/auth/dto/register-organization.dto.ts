import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationType } from '@prisma/client';

export class RegisterOrganizationDto {
  @ApiProperty({ example: 'Yılmaz Gayrimenkul', minLength: 2, maxLength: 150 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(2, 150) name!: string;

  @ApiProperty({ enum: OrganizationType, example: OrganizationType.REAL_ESTATE_AGENCY })
  @IsEnum(OrganizationType) type!: OrganizationType;

  @ApiProperty({ example: 'Türkiye', maxLength: 100 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100) country!: string;

  @ApiProperty({ example: 'Bursa', maxLength: 100 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100) city!: string;

  @ApiProperty({ example: 'Osmangazi', maxLength: 100 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100) district!: string;

  @ApiProperty({ example: 'Çekirge Mahallesi', maxLength: 500 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(500) address!: string;

  @ApiPropertyOptional({ example: '+902242221122', nullable: true, maxLength: 30 })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString() @MaxLength(30) phone?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true, maxLength: 50 })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString() @MaxLength(50) taxNumber?: string | null;
}
