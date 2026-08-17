import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Eko Paket' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 250.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyPrice?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  listingLimit?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  portalLimit?: number;

  @ApiPropertyOptional({ example: ['100 İlan', '10 Portal', '500 Müşteri'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ example: 'aylık' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(50)
  period?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
