import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuditContextService } from './audit-context.service';

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  constructor(private readonly context: AuditContextService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined;
    const userAgent = request.headers['user-agent'];
    this.context.run({
      ipAddress: forwardedIp ?? request.ip ?? request.socket.remoteAddress,
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : undefined,
    }, next);
  }
}
