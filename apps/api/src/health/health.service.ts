import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../publishing/rabbitmq.service';

export type DependencyState = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'error';
  checks: { application: 'up'; database?: DependencyState; rabbitmq?: DependencyState };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService, private readonly rabbitMq: RabbitMqService) {}

  live(): HealthResponse {
    return { status: 'ok', checks: { application: 'up' }, timestamp: new Date().toISOString() };
  }

  async ready(): Promise<HealthResponse> {
    const [database, rabbitmq] = await Promise.all([
      this.checkDatabase(),
      Promise.resolve(this.rabbitMq.isReady() ? 'up' : 'down' as DependencyState),
    ]);
    return this.response(database, rabbitmq);
  }

  private async checkDatabase(): Promise<DependencyState> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private response(database: DependencyState, rabbitmq: DependencyState): HealthResponse {
    return {
      status: database === 'up' && rabbitmq === 'up' ? 'ok' : 'error',
      checks: { application: 'up', database, rabbitmq },
      timestamp: new Date().toISOString(),
    };
  }
}
