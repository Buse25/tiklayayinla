import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsPageResponseDto } from './dto/audit-log-response.dto';
import { EntityAuditLogsParamsDto, ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAccessGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Oturumdaki kullanıcının audit kayıtlarını filtreleyerek listeler' })
  @ApiOkResponse({ type: AuditLogsPageResponseDto })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAuditLogsQueryDto): Promise<AuditLogsPageResponseDto> {
    return this.auditLogs.list(user.id, query);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Sahibi olunan entity için audit zaman çizelgesini döndürür' })
  @ApiOkResponse({ type: AuditLogsPageResponseDto })
  @ApiNotFoundResponse()
  listEntity(@CurrentUser() user: AuthenticatedUser, @Param() params: EntityAuditLogsParamsDto, @Query() query: ListAuditLogsQueryDto): Promise<AuditLogsPageResponseDto> {
    return this.auditLogs.listEntity(user.id, params.entityType, params.entityId, query);
  }
}
