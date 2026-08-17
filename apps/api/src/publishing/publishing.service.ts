import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { AttemptStatus, AuditAction, AuditEntityType, ConnectionStatus, ListingDomain, Prisma, PublicationAction, PublicationStatus } from '@prisma/client';
import type { CanonicalListing, PortalCode } from '@tiklayayinla/shared-types';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ListingStatusService } from '../listings/listing-status.service';
import { AdapterRegistry } from './adapter.registry';
import { RabbitMqService } from './rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import type { PublishListingJob } from './publishing.types';
import { AuditService } from '../audit/audit.service';
import { assertPropertySectorAccess, assertVehicleSectorAccess } from '../listings/sector-guard';
import { EidsListingAuthorizationService } from '../eids/eids-listing-authorization.service';

type PublishRequest = { portalAccountIds: string[] };
type RepublishRequest = { publicationIds: string[] };

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
    private readonly listingStatus: ListingStatusService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly eidsAuthorization: EidsListingAuthorizationService,
  ) {}

  async onModuleInit() {
    this.queue.consume((job) => this.process(job));
  }

  async requestPublish(user: AuthenticatedUser, listingId: string, request: PublishRequest) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId: user.id }, select: { id: true, status: true, listingDomain: true, media: { select: { id: true }, take: 1 } } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    assertDomainSectorAccess(user, listing.listingDomain, 'publish');
    await this.eidsAuthorization.assertPublishAllowed(user.id, listingId, listing.listingDomain);
    if (!listing.media.length) throw new UnprocessableEntityException('Yayınlama için ilanda en az bir görsel bulunmalıdır.');

    if (listing.status === 'ARCHIVED') throw new ConflictException('Arşivlenmiş ilan yayınlanamaz.');
    const accountIds = [...new Set(request.portalAccountIds)];
    const accounts = await this.prisma.userPortalAccount.findMany({
      where: { id: { in: accountIds }, userId: user.id },
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
          create: { listingId, portalId: account.portalId, status: PublicationStatus.PENDING },
          update: { status: PublicationStatus.PENDING, lastError: null },
          select: { id: true, status: true },
        });
        return { publication, account, action };
      })),
    );

    let queuedJobCount = 0;
    try {
      const enqueueResults = await Promise.allSettled(queued.map(({ publication, account, action }) => this.queue.publish({
        jobId: randomUUID(),
        listingId,
        publicationId: publication.id,
        portalAccountId: account.id,
        portalId: account.portalId,
        adapterKey: account.portal.adapterKey,
        action,
        attemptNumber: 1,
        createdAt: new Date().toISOString(),
      })));
      const failedPublicationIds = enqueueResults.flatMap((result, index) => result.status === 'rejected' ? [queued[index].publication.id] : []);
      const acceptedPublicationIds = enqueueResults.flatMap((result, index) => result.status === 'fulfilled' ? [queued[index].publication.id] : []);
      queuedJobCount = enqueueResults.filter((result) => result.status === 'fulfilled').length;
      if (acceptedPublicationIds.length) await this.prisma.listingPublication.updateMany({ where: { id: { in: acceptedPublicationIds } }, data: { status: PublicationStatus.QUEUED } });
      if (failedPublicationIds.length) await this.prisma.listingPublication.updateMany({ where: { id: { in: failedPublicationIds } }, data: { status: PublicationStatus.FAILED, lastError: 'Yayın işi kuyruğa gönderilemedi.' } });
      if (!enqueueResults.some((result) => result.status === 'fulfilled')) {
        await this.listingStatus.syncFromPublications(listingId);
        throw new ConflictException('Yayın işi kuyruğa gönderilemedi.');
      }
    } catch (error) {
      await this.prisma.listingPublication.updateMany({ where: { id: { in: queued.map(({ publication }) => publication.id) } }, data: { status: PublicationStatus.FAILED, lastError: 'Yayın işi kuyruğa gönderilemedi.' } });
      await this.listingStatus.syncFromPublications(listingId);
      throw error;
    }

    await this.listingStatus.markPublishing(listingId);

    await this.audit.log({ actorUserId: user.id, action: AuditAction.LISTING_PUBLISHED, entityType: AuditEntityType.LISTING, entityId: listingId, changes: { portalAccountCount: accountIds.length, jobsCreated: queuedJobCount } });

    return {
      accepted: true,
      listingId,
      queuedJobCount,
      publications: queued.map(({ publication, account }) => ({ id: publication.id, portalId: account.portalId, portalName: account.portal.name, status: PublicationStatus.QUEUED })),
    };
  }

  async requestRepublish(user: AuthenticatedUser, listingId: string, request: RepublishRequest) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId: user.id }, select: { id: true, status: true, listingDomain: true, media: { select: { id: true }, take: 1 } } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    assertDomainSectorAccess(user, listing.listingDomain, 'republish');
    await this.eidsAuthorization.assertPublishAllowed(user.id, listingId, listing.listingDomain);
    if (!listing.media.length) throw new UnprocessableEntityException('Yeniden yayınlama için ilanda en az bir görsel bulunmalıdır.');
    if (listing.status === 'ARCHIVED') throw new ConflictException('Arşivlenmiş ilan yeniden yayınlanamaz.');

    const publicationIds = [...new Set(request.publicationIds)];
    const publications = await this.prisma.listingPublication.findMany({
      where: { id: { in: publicationIds }, listingId, status: { in: [PublicationStatus.UPDATE_REQUIRED, PublicationStatus.FAILED] } },
      include: { portal: { select: { id: true, name: true, adapterKey: true, isActive: true } } },
    });
    if (publications.length !== publicationIds.length) throw new UnprocessableEntityException('Yalnızca UPDATE_REQUIRED veya FAILED durumundaki bu ilana ait yayınlar yeniden yayınlanabilir.');
    if (publications.some((publication) => !publication.portal.isActive)) throw new ConflictException('Pasif bir portal için yeniden yayın başlatılamaz.');

    const accounts = await this.prisma.userPortalAccount.findMany({ where: { userId: user.id, portalId: { in: publications.map((publication) => publication.portalId) } }, select: { id: true, portalId: true, connectionStatus: true } });
    const accountByPortal = new Map(accounts.map((account) => [account.portalId, account]));
    if (publications.some((publication) => accountByPortal.get(publication.portalId)?.connectionStatus !== ConnectionStatus.CONNECTED)) throw new ConflictException('Portal hesabı CONNECTED durumda olmadan yeniden yayın başlatılamaz.');

    await this.prisma.$transaction(async (tx) => {
      await tx.listingPublication.updateMany({ where: { id: { in: publicationIds } }, data: { status: PublicationStatus.PENDING, lastError: null } });
      await tx.listing.update({ where: { id: listingId }, data: { status: 'PUBLISHING' } });
    });

    let queuedJobCount = 0;
    try {
      const enqueueResults = await Promise.allSettled(publications.map((publication) => {
        const account = accountByPortal.get(publication.portalId)!;
        return this.queue.publish({ jobId: randomUUID(), listingId, publicationId: publication.id, portalAccountId: account.id, portalId: publication.portalId, adapterKey: publication.portal.adapterKey, action: publication.externalListingId ? PublicationAction.UPDATE : PublicationAction.CREATE, attemptNumber: 1, createdAt: new Date().toISOString() });
      }));
      const failedIds = enqueueResults.flatMap((result, index) => result.status === 'rejected' ? [publications[index].id] : []);
      const acceptedIds = enqueueResults.flatMap((result, index) => result.status === 'fulfilled' ? [publications[index].id] : []);
      queuedJobCount = enqueueResults.filter((result) => result.status === 'fulfilled').length;
      if (acceptedIds.length) await this.prisma.listingPublication.updateMany({ where: { id: { in: acceptedIds } }, data: { status: PublicationStatus.QUEUED } });
      if (failedIds.length) await this.prisma.listingPublication.updateMany({ where: { id: { in: failedIds } }, data: { status: PublicationStatus.FAILED, lastError: 'Yayın işi kuyruğa gönderilemedi.' } });
      if (!enqueueResults.some((result) => result.status === 'fulfilled')) {
        await this.listingStatus.syncFromPublications(listingId);
        throw new ConflictException('Yeniden yayın işi kuyruğa gönderilemedi.');
      }
    } catch (error) {
      await this.prisma.listingPublication.updateMany({ where: { id: { in: publicationIds }, status: PublicationStatus.QUEUED }, data: { status: PublicationStatus.FAILED, lastError: 'Yayın işi kuyruğa gönderilemedi.' } });
      await this.listingStatus.syncFromPublications(listingId);
      throw error;
    }

    await this.audit.log({ actorUserId: user.id, action: AuditAction.LISTING_REPUBLISHED, entityType: AuditEntityType.LISTING, entityId: listingId, changes: { publicationCount: publications.length, jobsCreated: queuedJobCount } });
    return { accepted: true, listingId, queuedJobCount, publications: publications.map((publication) => ({ id: publication.id, portalId: publication.portalId, portalName: publication.portal.name, status: PublicationStatus.QUEUED })) };
  }

  async getPublications(user: AuthenticatedUser, listingId: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId: user.id }, select: { id: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    const publications = await this.prisma.listingPublication.findMany({
      where: { listingId },
      include: { portal: { select: { id: true, name: true } }, attempts: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const accounts = await this.prisma.userPortalAccount.findMany({ where: { userId: user.id, portalId: { in: publications.map(({ portalId }) => portalId) } }, select: { id: true, portalId: true } });
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
    if (!await this.redis.claimJob(job.jobId, job.attemptNumber)) {
      this.logger.log({ event: 'duplicate_job_skipped', jobId: job.jobId, publicationId: job.publicationId });
      return;
    }
    const publication = await this.prisma.listingPublication.findUnique({
      where: { id: job.publicationId },
      include: { listing: { include: workerListingInclude }, portal: { select: { id: true, adapterKey: true } } },
    });
    if (!publication || publication.listingId !== job.listingId) {
      this.logger.warn(`Discarding unknown publishing job ${job.jobId}`);
      return;
    }

    const attempt = await this.prisma.$transaction(async (tx) => {
      await tx.listingPublication.update({ where: { id: publication.id }, data: { status: PublicationStatus.PROCESSING, lastError: null } });
      return tx.publicationAttempt.create({ data: { listingPublicationId: publication.id, action: job.action, status: AttemptStatus.STARTED, attemptNumber: job.attemptNumber } });
    });

    try {
      const account = await this.prisma.userPortalAccount.findFirst({ where: { id: job.portalAccountId, userId: publication.listing.ownerId, portalId: publication.portalId, connectionStatus: ConnectionStatus.CONNECTED }, select: { id: true } });
      if (publication.portal.id !== job.portalId) throw new Error('Portal kimliği değişti.');
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
      await this.listingStatus.syncFromPublications(publication.listingId);
      this.logger.log({ event: 'publication_succeeded', jobId: job.jobId, publicationId: publication.id, attemptNumber: job.attemptNumber });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen yayınlama hatası.';
      const sanitizedMessage = safePublishingError(error);
      const retryDelay = retryDelayFor(error, job.attemptNumber);
      await this.prisma.publicationAttempt.update({ where: { id: attempt.id }, data: { status: AttemptStatus.FAILED, errorMessage: sanitizedMessage } });
      if (retryDelay !== undefined) {
        try {
          const retryJob = { ...job, attemptNumber: job.attemptNumber + 1 };
          await this.redis.markRetry(job.jobId, retryJob.attemptNumber);
          await this.queue.scheduleRetry(retryJob, retryDelay, sanitizedMessage);
          await this.prisma.listingPublication.update({ where: { id: publication.id }, data: { status: PublicationStatus.QUEUED, lastError: sanitizedMessage } });
          await this.listingStatus.syncFromPublications(publication.listingId);
          return;
        } catch (queueError) {
          await this.redis.releaseJob(job.jobId);
          const queueMessage = safePublishingError(queueError);
          await this.prisma.listingPublication.update({ where: { id: publication.id }, data: { status: PublicationStatus.FAILED, lastError: queueMessage } });
          await this.listingStatus.syncFromPublications(publication.listingId);
          throw queueError;
        }
      }
      await this.queue.deadLetter(job, sanitizedMessage).catch(() => undefined);
      await this.prisma.listingPublication.update({ where: { id: publication.id }, data: { status: PublicationStatus.FAILED, lastError: sanitizedMessage } });
      await this.listingStatus.syncFromPublications(publication.listingId);
    }
  }
}

function retryDelayFor(error: unknown, attemptNumber: number): number | undefined {
  if (!isTransientError(error)) return undefined;
  return [5_000, 30_000, 120_000][attemptNumber - 1];
}

function isTransientError(error: unknown): boolean {
  const status = statusCodeFrom(error);
  if (status !== undefined) return status === 429 || status >= 500;
  return /timeout|timed out|econnreset|econnrefused|enotfound|socket|network|connection/.test(safePublishingError(error).toLowerCase());
}

function statusCodeFrom(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  const value = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  return typeof value === 'number' ? value : undefined;
}

function assertDomainSectorAccess(user: AuthenticatedUser, domain: ListingDomain, operation: 'publish' | 'republish'): void {
  if (domain === ListingDomain.VEHICLE) {
    assertVehicleSectorAccess(user, operation);
    return;
  }
  assertPropertySectorAccess(user, operation);
}

function safePublishingError(error: unknown): string {
  return (error instanceof Error ? error.message : 'Bilinmeyen yayınlama hatası.')
    .replace(/(authorization|bearer|token|password|credential|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 1_000);
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
    propertyType: listing.propertyType ?? 'OTHER',
    images: listing.media.map((media) => ({ id: media.id, url: media.url, sortOrder: media.sortOrder, altText: media.originalName ?? undefined })),
    contact: { name: `${listing.owner.firstName} ${listing.owner.lastName}`.trim(), phone: '', email: listing.owner.email },
    owner: { id: listing.owner.id, type: 'AGENT', displayName: `${listing.owner.firstName} ${listing.owner.lastName}`.trim() },
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
