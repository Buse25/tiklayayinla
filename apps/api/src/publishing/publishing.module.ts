import { Global, Module } from '@nestjs/common';
import { AdapterRegistry } from './adapter.registry';
import { RabbitMqService } from './rabbitmq.service';
import { PublishingService } from './publishing.service';
@Global()
@Module({ providers: [AdapterRegistry, RabbitMqService, PublishingService], exports: [AdapterRegistry, PublishingService] })
export class PublishingModule {}
