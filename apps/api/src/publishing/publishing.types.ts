import { PublicationAction } from '@prisma/client';

export const PUBLISHING_QUEUE = 'listing.publish';
export const PUBLISHING_RETRY_QUEUE = 'listing.publish.retry';
export const PUBLISHING_DEAD_QUEUE = 'listing.publish.dead';

export interface PublishListingJob {
  jobId: string;
  listingId: string;
  publicationId: string;
  portalAccountId: string;
  portalId: string;
  adapterKey: string;
  action: PublicationAction;
  attemptNumber: number;
  createdAt: string;
  lastError?: string;
}
