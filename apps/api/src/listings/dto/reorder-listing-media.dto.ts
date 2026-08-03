import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderListingMediaDto {
  @ApiProperty({ type: [String], example: ['media-uuid-1', 'media-uuid-2'] })
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true })
  mediaIds!: string[];
}
