import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContextService } from './audit-context.service';

type AuditEntry = {
  actorUserId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  changes?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService, private readonly context: AuditContextService) {}

  async log(entry: AuditEntry): Promise<void> {
    const request = this.context.get();
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          changes: sanitize(entry.changes) as Prisma.InputJsonValue | undefined,
          ipAddress: request?.ipAddress?.slice(0, 64),
          userAgent: request?.userAgent?.slice(0, 512),
        },
      });
    } catch {
      this.logger.error({ event: 'audit_log_write_failed', action: entry.action, entityType: entry.entityType, entityId: entry.entityId });
    }
  }
}

const sensitiveKey = /password|token|credential|secret|authorization|api[-_]?key/i;

function sanitize(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, item]) => [key, sanitize(item)]));
  }
  return String(value);
}
