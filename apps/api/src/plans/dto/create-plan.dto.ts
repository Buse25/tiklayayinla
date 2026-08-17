import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Eko Paket' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 250.0 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  monthlyPrice!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  listingLimit!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  portalLimit!: number;

  @ApiProperty({ example: ['100 İlan', '10 Portal', '500 Müşteri'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiProperty({ example: 'aylık' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  period!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
