import { Injectable } from '@nestjs/common';
import { ConnectionStatus, ListingStatus, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string): Promise<DashboardSummaryResponseDto> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOf7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOf30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      listingGroups,
      portalAccountGroups,
      publicationGroups,
      recentPublications,
      recentErrors,
      createdToday,
      createdLast7Days,
      createdLast30Days,
      totalActivePortals,
    ] = await Promise.all([
      this.prisma.listing.groupBy({ by: ['status'], where: { ownerId: userId }, _count: { _all: true } }),
      this.prisma.userPortalAccount.groupBy({ by: ['connectionStatus'], where: { userId }, _count: { _all: true } }),
      this.prisma.listingPublication.groupBy({ by: ['status'], where: { listing: { ownerId: userId } }, _count: { _all: true } }),
      this.prisma.listingPublication.findMany({
        where: { listing: { ownerId: userId } }, orderBy: { updatedAt: 'desc' }, take: 5,
        select: { id: true, status: true, externalUrl: true, publishedAt: true, updatedAt: true, listing: { select: { id: true, title: true } }, portal: { select: { name: true } } },
      }),
      this.prisma.listingPublication.findMany({
        where: { listing: { ownerId: userId }, status: PublicationStatus.FAILED }, orderBy: { updatedAt: 'desc' }, take: 5,
        select: { id: true, lastError: true, updatedAt: true, listing: { select: { id: true, title: true } }, portal: { select: { name: true } } },
      }),
      this.prisma.listing.count({ where: { ownerId: userId, createdAt: { gte: startOfToday } } }),
      this.prisma.listing.count({ where: { ownerId: userId, createdAt: { gte: startOf7DaysAgo } } }),
      this.prisma.listing.count({ where: { ownerId: userId, createdAt: { gte: startOf30DaysAgo } } }),
      this.prisma.portal.count({ where: { isActive: true } }),
    ]);

    const listingCounts = countBy(listingGroups);
    const accountCounts = countBy(portalAccountGroups);
    const publicationCounts = countBy(publicationGroups);
    return {
      listings: {
        total: total(listingCounts),
        draft: listingCounts[ListingStatus.DRAFT] ?? 0,
        publishing: listingCounts[ListingStatus.PUBLISHING] ?? 0,
        active: listingCounts[ListingStatus.ACTIVE] ?? 0,
        archived: listingCounts[ListingStatus.ARCHIVED] ?? 0,
        createdToday,
        createdLast7Days,
        createdLast30Days,
      },
      portalAccounts: {
        total: total(accountCounts),
        connected: accountCounts[ConnectionStatus.CONNECTED] ?? 0,
        failed: accountCounts[ConnectionStatus.FAILED] ?? 0,
        notTested: accountCounts[ConnectionStatus.NOT_TESTED] ?? 0,
        totalActivePortals,
      },
      publications: {
        total: total(publicationCounts),
        queued: publicationCounts[PublicationStatus.QUEUED] ?? 0,
        processing: publicationCounts[PublicationStatus.PROCESSING] ?? 0,
        published: publicationCounts[PublicationStatus.PUBLISHED] ?? 0,
        failed: publicationCounts[PublicationStatus.FAILED] ?? 0,
      },
      recentPublications: recentPublications.map((item) => ({ publicationId: item.id, listingId: item.listing.id, listingTitle: item.listing.title, portalName: item.portal.name, status: item.status, externalUrl: item.externalUrl, publishedAt: item.publishedAt, updatedAt: item.updatedAt })),
      recentErrors: recentErrors.map((item) => ({ publicationId: item.id, listingId: item.listing.id, listingTitle: item.listing.title, portalName: item.portal.name, lastError: item.lastError, updatedAt: item.updatedAt })),
    };
  }
}

function countBy<T extends string>(groups: Array<{ status?: T; connectionStatus?: T; _count: { _all: number } }>): Partial<Record<T, number>> {
  return Object.fromEntries(groups.map((group) => [(group.status ?? group.connectionStatus) as T, group._count._all])) as Partial<Record<T, number>>;
}
function total(counts: Partial<Record<string, number>>): number { return Object.values(counts).reduce<number>((sum, value) => sum + (value ?? 0), 0); }
