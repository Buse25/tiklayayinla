import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PublishingService } from '../publishing/publishing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings-query.dto';
import { ListingPublicationResponseDto } from './dto/listing-publication-response.dto';
import { ListingResponseDto, ListingsPageResponseDto } from './dto/listing-response.dto';
import { PublishListingDto } from './dto/publish-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';
import { UpdateListingResponseDto } from './dto/update-listing-response.dto';
import { RepublishListingDto } from './dto/republish-listing.dto';
import { ListingsService } from './listings.service';
import { BulkListingsService } from './bulk-listings.service';
import { BulkListingsResponseDto, BulkListingStatusDto, BulkPublishListingsDto, BulkRepublishListingsDto } from './dto/bulk-listings.dto';

@ApiTags('Listings')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService, private readonly publishing: PublishingService, private readonly bulk: BulkListingsService) {}

  @Post()
  @ApiOperation({ summary: 'Giriş yapan kullanıcı için taslak ilan oluşturur' })
  @ApiCreatedResponse({ type: ListingResponseDto })
  @ApiUnauthorizedResponse() @ApiUnprocessableEntityResponse()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListingDto) { return this.listings.create(user.id, dto); }

  @Get()
  @ApiOperation({ summary: 'Giriş yapan kullanıcının ilanlarını filtreleyerek listeler' })
  @ApiOkResponse({ type: ListingsPageResponseDto })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListListingsQueryDto) { return this.listings.findAll(user.id, query); }

  @Get(':id')
  @ApiOperation({ summary: 'Sahibi olunan ilanın medya ve portal yayın durumlarıyla detayını döndürür' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiNotFoundResponse({ description: 'İlan yok veya başka bir kullanıcıya ait' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.listings.findOne(user.id, id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Sahibi olunan ilanı kısmi olarak günceller' })
  @ApiOkResponse({ type: UpdateListingResponseDto })
  @ApiNotFoundResponse() @ApiUnprocessableEntityResponse() @ApiConflictResponse({ description: 'PUBLISHING ilan güncellenemez.' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateListingDto) { return this.listings.update(user.id, id, dto); }

  @Patch(':id/status')
  @ApiOperation({ summary: 'İlanı arşivler veya arşivden taslağa geri alır' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiConflictResponse()
  updateStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateListingStatusDto) { return this.listings.updateStatus(user.id, id, dto); }

  @Post(':id/publish')
  @ApiOperation({ summary: 'İlanı seçilen bağlı portal hesaplarına yayın için kuyruğa alır' })
  @ApiOkResponse({ description: 'Yayın işleri RabbitMQ kuyruğuna gönderildi.' })
  @ApiNotFoundResponse() @ApiConflictResponse() @ApiUnprocessableEntityResponse()
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PublishListingDto) { return this.publishing.requestPublish(user.id, id, dto); }

  @Post(':id/republish')
  @ApiOperation({ summary: 'Güncelleme gerektiren veya başarısız portal yayınlarını yeniden kuyruğa alır' })
  @ApiOkResponse({ description: 'Yeniden yayın işleri RabbitMQ kuyruğuna gönderildi.' })
  @ApiNotFoundResponse() @ApiConflictResponse() @ApiUnprocessableEntityResponse()
  republish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RepublishListingDto) { return this.publishing.requestRepublish(user.id, id, dto); }

  @Post('bulk/status')
  @ApiOperation({ summary: 'Birden fazla ilana status geçişi uygular' })
  @ApiOkResponse({ type: BulkListingsResponseDto })
  @ApiUnprocessableEntityResponse()
  bulkStatus(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkListingStatusDto) { return this.bulk.updateStatus(user.id, dto.listingIds, dto.status); }

  @Post('bulk/publish')
  @ApiOperation({ summary: 'Birden fazla ilanı seçilen portal hesaplarına yayın için kuyruğa alır' })
  @ApiOkResponse({ type: BulkListingsResponseDto })
  @ApiUnprocessableEntityResponse()
  bulkPublish(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkPublishListingsDto) { return this.bulk.publish(user.id, dto.listingIds, dto.portalAccountIds); }

  @Post('bulk/republish')
  @ApiOperation({ summary: 'Birden fazla ilanın güncelleme gerektiren yayınlarını yeniden kuyruğa alır' })
  @ApiOkResponse({ type: BulkListingsResponseDto })
  @ApiUnprocessableEntityResponse()
  bulkRepublish(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkRepublishListingsDto) { return this.bulk.republish(user.id, dto.listingIds); }

  @Get(':id/publications')
  @ApiOperation({ summary: 'İlanın portal yayın durumlarını ve son denemelerini döndürür' })
  @ApiOkResponse({ type: [ListingPublicationResponseDto] })
  @ApiNotFoundResponse()
  publications(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.publishing.getPublications(user.id, id); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Taslak veya arşiv ilanını kalıcı olarak siler' })
  @ApiNoContentResponse() @ApiNotFoundResponse() @ApiConflictResponse()
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> { await this.listings.remove(user.id, id); }
}
