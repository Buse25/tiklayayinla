import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';
import { AdminDashboardSummaryResponseDto } from './dto/admin-dashboard-summary-response.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Giriş yapan kullanıcının gerçek dashboard özetini döndürür' })
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  summary(@CurrentUser() user: AuthenticatedUser) { return this.dashboard.summary(user.id); }

  @Get('admin-summary')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AdminDashboardSummaryResponseDto })
  adminSummary() { return this.dashboard.adminSummary(); }
}
