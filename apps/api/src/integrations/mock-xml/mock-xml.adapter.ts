import type { CanonicalListing, PortalAdapter, PublishResult } from '@tiklayayinla/shared-types';

/** XML feed kullanan portallar için mapper örneği. */
export class MockXmlPortalAdapter implements PortalAdapter<string> {
  readonly portalCode = 'mock-xml';
  mapListing(listing: CanonicalListing): string {
    return `<listing><id>${listing.id}</id><title>${escapeXml(listing.title)}</title><price currency="${listing.currency}">${listing.price}</price><city>${escapeXml(listing.location.city)}</city><images>${listing.images.map(i => `<image>${escapeXml(i.url)}</image>`).join('')}</images></listing>`;
  }
  async publish(listing: CanonicalListing): Promise<PublishResult> {
    const payload = this.mapListing(listing); // Gerçekte burada SFTP/HTTP XML feed gönderilir.
    return { externalListingId: `xml-${listing.id}`, externalUrl: `https://mock-xml.local/listings/xml-${listing.id}`, publishedAt: new Date().toISOString(), rawResponse: { payload } };
  }
}
function escapeXml(value: string) { return value.replace(/[<>&'\"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!)); }
