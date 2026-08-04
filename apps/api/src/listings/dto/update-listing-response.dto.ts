import { ApiProperty } from '@nestjs/swagger';
import { ListingResponseDto } from './listing-response.dto';

export class UpdateListingResponseDto extends ListingResponseDto {
  @ApiProperty({ example: { required: true, affectedPublications: 2 } })
  publicationSync!: { required: boolean; affectedPublications: number };
}
