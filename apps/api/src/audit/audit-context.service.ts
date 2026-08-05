import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type AuditRequestContext = { ipAddress?: string; userAgent?: string };

@Injectable()
export class AuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditRequestContext>();

  run(context: AuditRequestContext, next: () => void): void {
    this.storage.run(context, next);
  }

  get(): AuditRequestContext | undefined {
    return this.storage.getStore();
  }
}
