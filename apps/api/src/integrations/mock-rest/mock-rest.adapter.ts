import type { CanonicalListing, PortalAdapter, PublishResult } from '@tiklayayinla/shared-types';

interface MockRestPayload { externalReference: string; headline: string; transaction: 'for_sale' | 'for_rent'; amount: { value: number; currency: string }; address: { city: string; district: string }; media: string[]; }
/** REST API kullanan portallar için mapper örneği. */
export class MockRestPortalAdapter implements PortalAdapter<MockRestPayload> {
  readonly portalCode = 'mock-rest';
  mapListing(listing: CanonicalListing): MockRestPayload {
    return { externalReference: listing.id, headline: listing.title, transaction: listing.listingType === 'SALE' ? 'for_sale' : 'for_rent', amount: { value: listing.price, currency: listing.currency }, address: { city: listing.location.city, district: listing.location.district }, media: listing.images.sort((a, b) => a.sortOrder - b.sortOrder).map(i => i.url) };
  }
  async publish(listing: CanonicalListing): Promise<PublishResult> {
    const payload = this.mapListing(listing); // Gerçekte burada portalın REST istemcisi çağrılır.
    return { externalListingId: `rest-${listing.id}`, externalUrl: `https://mock-rest.local/listings/rest-${listing.id}`, publishedAt: new Date().toISOString(), rawResponse: { payload } };
  }
}
