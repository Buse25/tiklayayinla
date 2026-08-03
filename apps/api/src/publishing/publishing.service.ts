import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { AttemptStatus, ConnectionStatus, Prisma, PublicationAction, PublicationStatus } from '@prisma/client';
import type { CanonicalListing, PortalCode } from '@tiklayayinla/shared-types';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdapterRegistry } from './adapter.registry';
import { RabbitMqService } from './rabbitmq.service';
import type { PublishListingJob } from './publishing.types';

type PublishRequest = { portalAccountIds: string[] };

const workerListingInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
  media: { orderBy: { sortOrder: 'asc' } },
  residentialDetails: { select: { grossArea: true, netArea: true, roomCount: true } },
} satisfies Prisma.ListingInclude;

@Injectable()
export class PublishingService implements OnModuleInit {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: RabbitMqService,
    private readonly adapters: AdapterRegistry,
  ) {}

  async onModuleInit() {
    try {
      await this.queue.consume((job) => this.process(job));
    } catch {
      this.logger.warn('RabbitMQ unavailable; worker will start when connectivity is configured.');
    }
  }

  async requestPublish(userId: string, listingId: string, request: PublishRequest) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId: userId }, select: { id: true, media: { select: { id: true }, take: 1 } } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    if (!listing.media.length) throw new UnprocessableEntityException('Yayınlama için ilanda en az bir görsel bulunmalıdır.');

    const accountIds = [...new Set(request.portalAccountIds)];
    const accounts = await this.prisma.userPortalAccount.findMany({
      where: { id: { in: accountIds }, userId },
      include: { portal: { select: { id: true, name: true, adapterKey: true, isActive: true } } },
    });
    if (accounts.length !== accountIds.length) throw new NotFoundException('Portal hesabı bulunamadı.');
    if (accounts.some((account) => !account.portal.isActive)) throw new ConflictException('Pasif bir portal için yayın başlatılamaz.');
    if (accounts.some((account) => account.connectionStatus !== ConnectionStatus.CONNECTED)) {
      throw new ConflictException('Portal hesabı CONNECTED durumda olmadan yayın başlatılamaz.');
    }

    const queued = await this.prisma.$transaction(async (tx) =>
      Promise.all(accounts.map(async (account) => {
        const current = await tx.listingPublication.findUnique({
          where: { listingId_portalId: { listingId, portalId: account.portalId } },
          select: { id: true, externalListingId: true },
        });
        const action = current?.externalListingId ? PublicationAction.UPDATE : PublicationAction.CREATE;
        const publication = await tx.listingPublication.upsert({
          where: { listingId_portalId: { listingId, portalId: account.portalId } },
          create: { listingId, portalId: account.portalId, status: PublicationStatus.QUEUED },
          update: { status: PublicationStatus.QUEUED, lastError: null },
          select: { id: true, status: true },
        });
        return { publication, account, action };
      })),
    );

    try {
      await Promise.all(queued.map(({ publication, account, action }) => this.queue.publish({
        jobId: randomUUID(),
        listingId,
        listingPublicationId: publication.id,
        userPortalAccountId: account.id,
        adapterKey: account.portal.adapterKey,
        action,
        requestedAt: new Date().toISOString(),
      })));
    } catch (error) {
      await this.prisma.listingPublication.updateMany({ where: { id: { in: queued.map(({ publication }) => publication.id) } }, data: { status: PublicationStatus.FAILED, lastError: 'Yayın işi kuyruğa gönderilemedi.' } });
      throw error;
    }

    return {
      accepted: true,
      listingId,
      publications: queued.map(({ publication, account }) => ({ id: publication.id, portalId: account.portalId, portalName: account.portal.name, status: publication.status })),
    };
  }

  async getPublications(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId: userId }, select: { id: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    const publications = await this.prisma.listingPublication.findMany({
      where: { listingId },
      include: { portal: { select: { id: true, name: true } }, attempts: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const accounts = await this.prisma.userPortalAccount.findMany({ where: { userId, portalId: { in: publications.map(({ portalId }) => portalId) } }, select: { id: true, portalId: true } });
    const accountByPortal = new Map(accounts.map((account) => [account.portalId, account]));
    return publications.map((publication) => ({
      id: publication.id,
      portalName: publication.portal.name,
      portalAccountId: accountByPortal.get(publication.portalId)?.id ?? null,
      accountName: publication.portal.name,
      status: publication.status,
      externalUrl: publication.externalUrl,
      lastError: publication.lastError,
      lastAttemptAt: publication.attempts[0]?.createdAt ?? null,
      updatedAt: publication.updatedAt,
    }));
  }

  private async process(job: PublishListingJob): Promise<void> {
    const publication = await this.prisma.listingPublication.findUnique({
      where: { id: job.listingPublicationId },
      include: { listing: { include: workerListingInclude }, portal: { select: { id: true, adapterKey: true } } },
    });
    if (!publication || publication.listingId !== job.listingId) {
      this.logger.warn(`Discarding unknown publishing job ${job.jobId}`);
      return;
    }

    const attemptNumber = (await this.prisma.publicationAttempt.aggregate({ where: { listingPublicationId: publication.id, action: job.action }, _max: { attemptNumber: true } }))._max.attemptNumber ?? 0;
    const attempt = await this.prisma.$transaction(async (tx) => {
      await tx.listingPublication.update({ where: { id: publication.id }, data: { status: PublicationStatus.PROCESSING, lastError: null } });
      return tx.publicationAttempt.create({ data: { listingPublicationId: publication.id, action: job.action, status: AttemptStatus.STARTED, attemptNumber: attemptNumber + 1 } });
    });

    try {
      const account = await this.prisma.userPortalAccount.findFirst({ where: { id: job.userPortalAccountId, userId: publication.listing.ownerId, portalId: publication.portalId, connectionStatus: ConnectionStatus.CONNECTED }, select: { id: true } });
      if (!account) throw new Error('Portal hesabı bulunamadı veya bağlantısı aktif değil.');
      if (publication.portal.adapterKey !== job.adapterKey) throw new Error('Portal adapter anahtarı değişti.');

      const canonicalListing = toCanonicalListing(publication.listing);
      const adapter = this.adapters.get(job.adapterKey as PortalCode);
      const requestPayload = adapter.mapListing(canonicalListing);
      await this.prisma.publicationAttempt.update({ where: { id: attempt.id }, data: { requestPayload: toJson(requestPayload) } });
      const result = await adapter.publish(canonicalListing);

      await this.prisma.$transaction([
        this.prisma.publicationAttempt.update({ where: { id: attempt.id }, data: { status: AttemptStatus.SUCCEEDED, responsePayload: toJson(result.rawResponse) } }),
        this.prisma.listingPublication.update({ where: { id: publication.id }, data: { status: PublicationStatus.PUBLISHED, externalListingId: result.externalListingId, externalUrl: result.externalUrl ?? null, publishedAt: new Date(result.publishedAt), lastError: null } }),
      ]);
      this.logger.log(`Listing ${publication.listingId} published to ${job.adapterKey}: ${result.externalListingId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen yayınlama hatası.';
      await this.prisma.$transaction([
        this.prisma.publicationAttempt.update({ where: { id: attempt.id }, data: { status: AttemptStatus.FAILED, errorMessage: message } }),
        this.prisma.listingPublication.update({ where: { id: publication.id }, data: { status: PublicationStatus.FAILED, lastError: message } }),
      ]);
      throw error;
    }
  }
}

function toCanonicalListing(listing: Prisma.ListingGetPayload<{ include: typeof workerListingInclude }>): CanonicalListing {
  const grossArea = listing.residentialDetails?.grossArea ?? listing.residentialDetails?.netArea ?? 0;
  return {
    id: listing.id,
    tenantId: listing.ownerId,
    title: listing.title,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency,
    location: { address: listing.address, district: listing.district, city: listing.city, country: 'TR', ...(listing.latitude !== null && listing.longitude !== null && { coordinates: { latitude: Number(listing.latitude), longitude: Number(listing.longitude) } }) },
    rooms: listing.residentialDetails?.roomCount ?? undefined,
    areaSqm: Number(grossArea),
    listingType: listing.listingType,
    propertyType: listing.propertyType,
    images: listing.media.map((media) => ({ id: media.id, url: media.url, sortOrder: media.sortOrder, altText: media.originalName ?? undefined })),
    contact: { name: `${listing.owner.firstName} ${listing.owner.lastName}`.trim(), phone: '', email: listing.owner.email },
    owner: { id: listing.owner.id, type: listing.owner.role === 'AGENCY_OWNER' ? 'AGENCY' : 'AGENT', displayName: `${listing.owner.firstName} ${listing.owner.lastName}`.trim() },
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
