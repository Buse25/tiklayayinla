import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewOrganizationApplicationDto {
  @ApiProperty({ example: 'Belgeler eksik olduğu için reddedildi.', required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsString()
  @MaxLength(500)
  rejectionReason?: string | null;
}
