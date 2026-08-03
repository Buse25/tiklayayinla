import type { CanonicalListing } from './canonical-listing.model';

export type PortalCode = 'mock-xml' | 'mock-rest' | (string & {});

export interface PortalAdapter<TPayload = unknown> {
  readonly portalCode: PortalCode;
  mapListing(listing: CanonicalListing): TPayload;
  publish(listing: CanonicalListing): Promise<PublishResult>;
  unpublish?(externalListingId: string): Promise<void>;
}

export interface PublishResult {
  externalListingId: string;
  externalUrl?: string;
  publishedAt: string;
  rawResponse?: unknown;
}
