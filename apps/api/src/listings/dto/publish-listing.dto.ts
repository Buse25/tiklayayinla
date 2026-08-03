import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class PublishListingDto {
  @ApiProperty({ type: [String], example: ['4e496765-e53a-4fe2-84bc-5f0695d56d9e'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  portalAccountIds!: string[];
}
