import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UploadedFiles, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ListingMediaResponseDto } from './dto/listing-media-response.dto';
import { ReorderListingMediaDto } from './dto/reorder-listing-media.dto';
import { MulterValidationFilter } from './filters/multer-validation.filter';
import { ListingMediaService } from './listing-media.service';

const TEN_MB = 10 * 1024 * 1024;

@ApiTags('Listing Media')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Access token geçersiz veya eksik.' })
@UseGuards(JwtAccessGuard)
@Controller('listings/:id/media')
export class ListingMediaController {
  constructor(private readonly media: ListingMediaService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseFilters(MulterValidationFilter)
  @UseInterceptors(FilesInterceptor('files', 30, { storage: memoryStorage(), limits: { fileSize: TEN_MB, files: 30 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bir ilana en fazla 30 JPEG, PNG veya WebP görsel yükler' })
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } }, required: ['files'] } })
  @ApiCreatedResponse({ type: [ListingMediaResponseDto] })
  @ApiUnprocessableEntityResponse({ description: 'Geçersiz dosya, boyut veya görsel limiti' })
  @ApiTooManyRequestsResponse({ description: 'Dosya yükleme için bir dakika içinde en fazla 20 istek gönderilebilir.' })
  upload(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) listingId: string, @UploadedFiles() files: Express.Multer.File[] = []) { return this.media.upload(user, listingId, files); }

  @Get()
  @ApiOperation({ summary: 'İlan görsellerini sıralı olarak getirir' })
  @ApiOkResponse({ type: [ListingMediaResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) listingId: string) { return this.media.findAll(user, listingId); }

  @Patch('reorder')
  @ApiOperation({ summary: 'İlanın tüm görsellerinin sırasını tek transaction içinde günceller' })
  @ApiOkResponse({ type: [ListingMediaResponseDto] })
  reorder(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) listingId: string, @Body() dto: ReorderListingMediaDto) { return this.media.reorder(user, listingId, dto.mediaIds); }

  @Patch(':mediaId/cover')
  @ApiOperation({ summary: 'Görseli kapak olarak atar' })
  @ApiOkResponse({ type: ListingMediaResponseDto })
  setCover(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) listingId: string, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) { return this.media.setCover(user, listingId, mediaId); }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Görseli ve yerel dosyasını siler; kapak silinirse sıradakini kapak yapar' })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) listingId: string, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string): Promise<void> { await this.media.remove(user, listingId, mediaId); }
}
