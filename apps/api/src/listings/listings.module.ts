import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingMediaController } from './listing-media.controller';
import { ListingMediaService } from './listing-media.service';

@Module({ controllers: [ListingsController, ListingMediaController], providers: [ListingsService, ListingMediaService] })
export class ListingsModule {}
