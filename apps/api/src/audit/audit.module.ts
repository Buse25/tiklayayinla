import { Global, Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditContextMiddleware } from './audit-context.middleware';
import { AuditContextService } from './audit-context.service';
import { AuditLogsService } from './audit-logs.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [
    AuditContextService,
    AuditContextMiddleware,
    AuditService,
    AuditLogsService,
  ],
  exports: [AuditContextService, AuditContextMiddleware, AuditService],
})
export class AuditModule {}
