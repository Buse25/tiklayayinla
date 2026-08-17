import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EidsVerificationMethod, ListingDomain } from '@prisma/client';

export const EIDS_LISTING_AUTHORIZATION_PROVIDER = Symbol('EIDS_LISTING_AUTHORIZATION_PROVIDER');

export type EidsListingAuthorizationInput = {
  listingId: string;
  userId: string;
  domain: ListingDomain;
  userCode: string;
  localSnapshot: Record<string, unknown>;
};

export type EidsListingAuthorizationResult = {
  verificationMethod: EidsVerificationMethod;
  externalReference?: string;
  snapshot?: Record<string, unknown>;
  validUntil?: Date;
  nextCheckAt?: Date;
};

export interface EidsListingAuthorizationProvider {
  verifyProperty(input: EidsListingAuthorizationInput): Promise<EidsListingAuthorizationResult>;
  verifyVehicle(input: EidsListingAuthorizationInput): Promise<EidsListingAuthorizationResult>;
}

/** Gerçek Bakanlık provider'ı bağlanana kadar success dönmeyen production provider. */
@Injectable()
export class UnconfiguredEidsListingAuthorizationProvider implements EidsListingAuthorizationProvider {
  verifyProperty(): Promise<EidsListingAuthorizationResult> {
    return Promise.reject(new ServiceUnavailableException('EİDS taşınmaz yetkilendirme providerı yapılandırılmamış.'));
  }

  verifyVehicle(): Promise<EidsListingAuthorizationResult> {
    return Promise.reject(new ServiceUnavailableException('EİDS araç yetkilendirme providerı yapılandırılmamış.'));
  }
}
