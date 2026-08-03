import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { PUBLISHING_QUEUE, type PublishListingJob } from './publishing.types';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private async getChannel() {
    if (this.channel) return this.channel;
    this.connection = await amqp.connect(process.env.RABBITMQ_URL ?? 'amqp://localhost:5672');
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(PUBLISHING_QUEUE, { durable: true });
    return this.channel;
  }
  async publish(job: PublishListingJob) {
    const channel = await this.getChannel();
    channel.sendToQueue(PUBLISHING_QUEUE, Buffer.from(JSON.stringify(job)), { persistent: true });
  }
  async consume(handler: (job: PublishListingJob) => Promise<void>) {
    const channel = await this.getChannel();
    channel.prefetch(5);
    await channel.consume(PUBLISHING_QUEUE, async message => {
      if (!message) return;
      try { await handler(JSON.parse(message.content.toString()) as PublishListingJob); channel.ack(message); }
      catch (error) { this.logger.error('Publish job failed', error); channel.nack(message, false, false); }
    });
  }
  async onModuleDestroy() { await this.connection?.close(); }
}
