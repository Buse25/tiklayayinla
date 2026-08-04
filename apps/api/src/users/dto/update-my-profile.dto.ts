import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Ayşe', minLength: 2, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Yılmaz', minLength: 2, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 50)
  lastName?: string;

  @ApiPropertyOptional({ example: '+905551112233', nullable: true, description: 'Boş metin null olarak kaydedilir.' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value)
  @IsString()
  phone?: string | null;
}
