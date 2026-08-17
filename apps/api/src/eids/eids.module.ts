import { Module } from '@nestjs/common';
import { EidsController } from './eids.controller';
import { EidsHttpClient } from './eids.client';
import { EidsService } from './eids.service';
import { EidsListingAuthorizationService } from './eids-listing-authorization.service';
import { EIDS_LISTING_AUTHORIZATION_PROVIDER, UnconfiguredEidsListingAuthorizationProvider } from './eids-listing-authorization.provider';

@Module({
  controllers: [EidsController],
  providers: [
    EidsHttpClient,
    EidsService,
    EidsListingAuthorizationService,
    { provide: EIDS_LISTING_AUTHORIZATION_PROVIDER, useClass: UnconfiguredEidsListingAuthorizationProvider },
  ],
  exports: [EidsService, EidsListingAuthorizationService],
})
export class EidsModule {}
