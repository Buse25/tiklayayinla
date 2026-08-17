import { Global, Module } from '@nestjs/common';
import { AdapterRegistry } from './adapter.registry';
import { RabbitMqService } from './rabbitmq.service';
import { PublishingService } from './publishing.service';
import { ListingStatusService } from '../listings/listing-status.service';
import { EidsModule } from '../eids/eids.module';
@Global()
@Module({ imports: [EidsModule], providers: [AdapterRegistry, RabbitMqService, PublishingService, ListingStatusService], exports: [AdapterRegistry, PublishingService, RabbitMqService] })
export class PublishingModule {}
