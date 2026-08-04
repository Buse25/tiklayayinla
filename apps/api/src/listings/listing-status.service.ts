import { Injectable } from '@nestjs/common';
import { ListingStatus, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListingStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async markPublishing(listingId: string): Promise<ListingStatus> {
    return this.syncFromPublications(listingId);
  }

  async syncFromPublications(listingId: string): Promise<ListingStatus> {
    const publications = await this.prisma.listingPublication.findMany({ where: { listingId }, select: { status: true } });
    const status = calculateListingStatus(publications.map((publication) => publication.status));
    await this.prisma.listing.update({ where: { id: listingId }, data: { status } });
    return status;
  }
}

export function calculateListingStatus(publicationStatuses: PublicationStatus[]): ListingStatus {
  if (publicationStatuses.some((status) => status === PublicationStatus.PUBLISHED)) return ListingStatus.ACTIVE;
  if (publicationStatuses.some((status) => status === PublicationStatus.PENDING || status === PublicationStatus.QUEUED || status === PublicationStatus.PROCESSING)) return ListingStatus.PUBLISHING;
  return ListingStatus.DRAFT;
}
