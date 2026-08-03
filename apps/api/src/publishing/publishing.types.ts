export const PUBLISHING_QUEUE = 'listing.publish';

export interface PublishListingJob {
  jobId: string;
  listingId: string;
  listingPublicationId: string;
  userPortalAccountId: string;
  adapterKey: string;
  action: 'CREATE' | 'UPDATE';
  requestedAt: string;
}
