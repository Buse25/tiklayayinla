import { Injectable, NotFoundException } from '@nestjs/common';
import type { PortalAdapter, PortalCode } from '@tiklayayinla/shared-types';
import { MockXmlPortalAdapter } from '../integrations/mock-xml/mock-xml.adapter';
import { MockRestPortalAdapter } from '../integrations/mock-rest/mock-rest.adapter';

@Injectable()
export class AdapterRegistry {
  private readonly adapters = new Map<PortalCode, PortalAdapter>([
    ['mock-xml', new MockXmlPortalAdapter()],
    ['mock-rest', new MockRestPortalAdapter()],
  ]);
  get(portalCode: PortalCode): PortalAdapter {
    const adapter = this.adapters.get(portalCode);
    if (!adapter) throw new NotFoundException(`Portal adapter not found: ${portalCode}`);
    return adapter;
  }
  list() { return [...this.adapters.keys()]; }
}
