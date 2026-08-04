import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 1_000, 10_000),
    });
    this.client.on('error', () => this.logger.warn({ event: 'redis_unavailable' }));
  }

  async claimJob(jobId: string, attemptNumber: number): Promise<boolean> {
    try {
      if (this.client.status === 'wait') await this.client.connect();
      const key = `publishing:job:${jobId}`;
      if ((await this.client.set(key, `processing:${attemptNumber}`, 'EX', 86_400, 'NX')) === 'OK') return true;
      if (await this.client.get(key) !== `retry:${attemptNumber}`) return false;
      return (await this.client.set(key, `processing:${attemptNumber}`, 'EX', 86_400, 'XX')) === 'OK';
    } catch {
      // İdempotency garantisi yokken adapter çağrılmamalıdır.
      throw new Error('Yayın idempotency deposuna erişilemiyor.');
    }
  }

  async releaseJob(jobId: string): Promise<void> {
    try { await this.client.del(`publishing:job:${jobId}`); } catch { /* sonraki teslimde tekrar çalışma güvenliği korunur */ }
  }

  async markRetry(jobId: string, attemptNumber: number): Promise<void> {
    try { await this.client.set(`publishing:job:${jobId}`, `retry:${attemptNumber}`, 'EX', 86_400, 'XX'); }
    catch { throw new Error('Yayın idempotency deposuna erişilemiyor.'); }
  }

  async onModuleDestroy(): Promise<void> { await this.client.quit(); }
}
