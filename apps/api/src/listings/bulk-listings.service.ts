import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ListingStatus, PublicationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { PublishingService } from '../publishing/publishing.service';
import type { BulkListingResultDto, BulkListingsResponseDto } from './dto/bulk-listings.dto';
import { ListingsService } from './listings.service';
import { assertPropertySectorAccess } from './sector-guard';

const maxListings = 100;

@Injectable()
export class BulkListingsService {
  constructor(private readonly prisma: PrismaService, private readonly listings: ListingsService, private readonly publishing: PublishingService) {}

  async updateStatus(user: AuthenticatedUser, listingIds: string[], status: ListingStatus): Promise<BulkListingsResponseDto> {
    assertPropertySectorAccess(user, 'status');
    return this.run(listingIds, async (listingId) => {
      const listing = await this.listings.updateStatus(user, listingId, { status });
      return { listingId, success: true, status: listing.status };
    }, 'status');
  }

  async publish(user: AuthenticatedUser, listingIds: string[], portalAccountIds: string[]): Promise<BulkListingsResponseDto> {
    assertPropertySectorAccess(user, 'publish');
    return this.run(listingIds, async (listingId) => {
      const result = await this.publishing.requestPublish(user, listingId, { portalAccountIds });
      return { listingId, success: true, jobsCreated: result.queuedJobCount };
    }, 'publish');
  }

  async republish(user: AuthenticatedUser, listingIds: string[]): Promise<BulkListingsResponseDto> {
    assertPropertySectorAccess(user, 'republish');
    return this.run(listingIds, async (listingId) => {
      const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId: user.id }, select: { id: true } });
      if (!listing) throw new NotFoundException('İlan bulunamadı.');
      const publications = await this.prisma.listingPublication.findMany({ where: { listingId, status: { in: [PublicationStatus.UPDATE_REQUIRED, PublicationStatus.FAILED] } }, select: { id: true } });
      if (!publications.length) throw new UnprocessableEntityException('Yeniden yayınlanabilecek UPDATE_REQUIRED veya FAILED publication kaydı yok.');
      const result = await this.publishing.requestRepublish(user, listingId, { publicationIds: publications.map((publication) => publication.id) });
      return { listingId, success: true, jobsCreated: result.queuedJobCount };
    }, 'republish');
  }

  private async run(listingIds: string[], operation: (listingId: string) => Promise<BulkListingResultDto>, kind: 'status' | 'publish' | 'republish'): Promise<BulkListingsResponseDto> {
    const normalizedIds = [...new Set(listingIds)];
    if (normalizedIds.length > maxListings) throw new UnprocessableEntityException(`Tek istekte en fazla ${maxListings} ilan işlenebilir.`);
    const results: BulkListingResultDto[] = [];
    for (const listingId of normalizedIds) {
      try { results.push(await operation(listingId)); }
      catch (error) { results.push({ listingId, success: false, ...toError(error, kind) }); }
    }
    const successful = results.filter((result) => result.success).length;
    return { requested: normalizedIds.length, successful, failed: normalizedIds.length - successful, jobsCreated: results.reduce((sum, result) => sum + (result.jobsCreated ?? 0), 0), results };
  }
}

function toError(error: unknown, kind: 'status' | 'publish' | 'republish'): { errorCode: string; message: string } {
  const message = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
  if (error instanceof NotFoundException) return { errorCode: 'LISTING_NOT_FOUND', message };
  if (kind === 'status' && error instanceof ConflictException) return { errorCode: 'INVALID_STATUS_TRANSITION', message };
  if (kind === 'republish' && error instanceof UnprocessableEntityException && message.includes('UPDATE_REQUIRED')) return { errorCode: 'NO_ELIGIBLE_PUBLICATIONS', message };
  if (error instanceof ConflictException) return { errorCode: `${kind.toUpperCase()}_CONFLICT`, message };
  if (error instanceof UnprocessableEntityException) return { errorCode: `${kind.toUpperCase()}_VALIDATION`, message };
  return { errorCode: `${kind.toUpperCase()}_FAILED`, message };
}
