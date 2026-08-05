import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsPageResponseDto } from './dto/audit-log-response.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListAuditLogsQueryDto): Promise<AuditLogsPageResponseDto> {
    if (query.actorUserId && query.actorUserId !== userId) return emptyPage(query);
    return this.find(userId, query);
  }

  async listEntity(userId: string, entityType: AuditEntityType, entityId: string, query: ListAuditLogsQueryDto): Promise<AuditLogsPageResponseDto> {
    await this.assertEntityAccess(userId, entityType, entityId);
    return this.find(userId, query, { entityType, entityId });
  }

  private async find(userId: string, query: ListAuditLogsQueryDto, fixed: Pick<Prisma.AuditLogWhereInput, 'entityType' | 'entityId'> = {}): Promise<AuditLogsPageResponseDto> {
    const where: Prisma.AuditLogWhereInput = {
      actorUserId: userId,
      ...(query.action && { action: query.action }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...((query.dateFrom || query.dateTo) && { createdAt: { ...(query.dateFrom && { gte: new Date(query.dateFrom) }), ...(query.dateTo && { lte: new Date(query.dateTo) }) } }),
      ...fixed,
    };
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: query.sortOrder } }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actors = logs.length ? await this.prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((log) => log.actorUserId))] } }, select: { id: true, firstName: true, lastName: true, role: true } }) : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    return {
      data: logs.map((log) => ({ ...log, actor: actorById.get(log.actorUserId) ?? null, changes: sanitizeResponse(log.changes) as Record<string, unknown> | null })),
      pagination: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) },
    };
  }

  private async assertEntityAccess(userId: string, entityType: AuditEntityType, entityId: string): Promise<void> {
    if (entityType === AuditEntityType.USER && entityId !== userId) throw new NotFoundException('Audit kaydı bulunamadı.');
    const ownLog = await this.prisma.auditLog.findFirst({ where: { actorUserId: userId, entityType, entityId }, select: { id: true } });
    if (!ownLog && entityType === AuditEntityType.IMPORT_BATCH) throw new NotFoundException('Audit kaydı bulunamadı.');

    if (entityType === AuditEntityType.LISTING) {
      const listing = await this.prisma.listing.findUnique({ where: { id: entityId }, select: { ownerId: true } });
      if (listing ? listing.ownerId !== userId : !ownLog) throw new NotFoundException('Audit kaydı bulunamadı.');
    }
    if (entityType === AuditEntityType.PORTAL_ACCOUNT) {
      const account = await this.prisma.userPortalAccount.findUnique({ where: { id: entityId }, select: { userId: true } });
      if (account ? account.userId !== userId : !ownLog) throw new NotFoundException('Audit kaydı bulunamadı.');
    }
  }
}

function emptyPage(query: ListAuditLogsQueryDto): AuditLogsPageResponseDto {
  return { data: [], pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 } };
}

const sensitiveKey = /password|token|credential|secret|authorization|api[-_]?key/i;

function sanitizeResponse(value: Prisma.JsonValue | null): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(sanitizeResponse);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, item]) => [key, sanitizeResponse(item ?? null)]),
  );
}
