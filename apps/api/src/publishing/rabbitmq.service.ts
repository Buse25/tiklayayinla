import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { PUBLISHING_DEAD_QUEUE, PUBLISHING_QUEUE, PUBLISHING_RETRY_QUEUE, type PublishListingJob } from './publishing.types';

type JobHandler = (job: PublishListingJob) => Promise<void>;

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.ConfirmChannel;
  private consumerTag?: string;
  private handler?: JobHandler;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectInFlight = false;
  private retryDelayMs = 2_000;
  private stopping = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void { this.scheduleReconnect(0); }

  isReady(): boolean { return Boolean(this.connection && this.channel && this.consumerTag); }

  async publish(job: PublishListingJob): Promise<void> {
    const channel = this.requireChannel();
    await this.confirmSend(channel, PUBLISHING_QUEUE, job);
    this.logger.log({ event: 'job_published', jobId: job.jobId, publicationId: job.publicationId, attemptNumber: job.attemptNumber });
  }

  async scheduleRetry(job: PublishListingJob, delayMs: number, lastError: string): Promise<void> {
    const channel = this.requireChannel();
    const retryJob = { ...job, lastError };
    await this.confirmSend(channel, PUBLISHING_RETRY_QUEUE, retryJob, { expiration: String(delayMs) });
    this.logger.warn({ event: 'retry_scheduled', jobId: job.jobId, publicationId: job.publicationId, attemptNumber: job.attemptNumber, delayMs });
  }

  async deadLetter(job: PublishListingJob, lastError: string): Promise<void> {
    const channel = this.requireChannel();
    await this.confirmSend(channel, PUBLISHING_DEAD_QUEUE, { ...job, lastError });
    this.logger.error({ event: 'job_dead_lettered', jobId: job.jobId, publicationId: job.publicationId, attemptNumber: job.attemptNumber });
  }

  consume(handler: JobHandler): void {
    this.handler = handler;
    if (this.channel) void this.startConsumer();
    else this.scheduleReconnect(0);
  }

  private requireChannel(): amqp.ConfirmChannel {
    if (!this.channel) {
      this.scheduleReconnect();
      throw new Error('RabbitMQ bağlantısı hazır değil.');
    }
    return this.channel;
  }

  private async confirmSend(channel: amqp.ConfirmChannel, queue: string, job: PublishListingJob, options: amqp.Options.Publish = {}): Promise<void> {
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(job)), { persistent: true, contentType: 'application/json', ...options });
    await channel.waitForConfirms();
  }

  private scheduleReconnect(delay = this.retryDelayMs): void {
    if (this.stopping || this.reconnectTimer || this.reconnectInFlight || this.connection) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, delay);
  }

  private async connect(): Promise<void> {
    if (this.stopping || this.reconnectInFlight || this.connection) return;
    this.reconnectInFlight = true;
    try {
      this.logger.log({ event: 'rabbitmq_reconnect_attempt', delayMs: this.retryDelayMs });
      const connection = await amqp.connect(this.config.getOrThrow<string>('RABBITMQ_URL'), { timeout: 5_000 });
      connection.on('error', () => undefined);
      connection.on('close', () => this.handleDisconnect());
      const channel = await connection.createConfirmChannel();
      channel.on('error', () => this.handleDisconnect());
      channel.on('close', () => this.handleDisconnect());
      await this.assertTopology(channel);
      if (this.stopping) {
        await channel.close().catch(() => undefined);
        await connection.close().catch(() => undefined);
        return;
      }
      this.connection = connection;
      this.channel = channel;
      this.retryDelayMs = 2_000;
      await this.startConsumer();
      this.logger.log({ event: 'rabbitmq_connected' });
    } catch {
      this.connection = undefined;
      this.channel = undefined;
      this.logger.warn({ event: 'rabbitmq_reconnect_failed', nextDelayMs: this.retryDelayMs });
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, 30_000);
      this.reconnectInFlight = false;
      this.scheduleReconnect(this.retryDelayMs);
    } finally {
      this.reconnectInFlight = false;
    }
  }

  private async assertTopology(channel: amqp.ConfirmChannel): Promise<void> {
    await channel.assertQueue(PUBLISHING_QUEUE, { durable: true });
    await channel.assertQueue(PUBLISHING_RETRY_QUEUE, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': PUBLISHING_QUEUE },
    });
    await channel.assertQueue(PUBLISHING_DEAD_QUEUE, { durable: true });
    await channel.prefetch(5);
  }

  private async startConsumer(): Promise<void> {
    if (!this.channel || !this.handler || this.consumerTag) return;
    const { consumerTag } = await this.channel.consume(PUBLISHING_QUEUE, async (message) => {
      if (!message || !this.channel || !this.handler) return;
      try {
        await this.handler(JSON.parse(message.content.toString()) as PublishListingJob);
        this.channel.ack(message);
      } catch (error) {
        this.logger.error({ event: 'job_handler_failed', message: sanitizedRabbitError(error) });
        this.channel.nack(message, false, true);
      }
    });
    this.consumerTag = consumerTag;
  }

  private handleDisconnect(): void {
    const wasConnected = Boolean(this.connection || this.channel);
    this.connection = undefined;
    this.channel = undefined;
    this.consumerTag = undefined;
    if (wasConnected) this.logger.warn({ event: 'rabbitmq_disconnected' });
    this.scheduleReconnect();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const channel = this.channel;
    const connection = this.connection;
    this.channel = undefined;
    this.connection = undefined;
    this.consumerTag = undefined;
    await channel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  }
}

function sanitizedRabbitError(error: unknown): string {
  return safeErrorMessage(error)
    .replace(/(authorization|bearer|token|password|credential|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 1_000);
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Bilinmeyen RabbitMQ hatası.';
}
