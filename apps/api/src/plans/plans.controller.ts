import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAllActive() {
    return this.plansService.findAllActive();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard, AdminGuard)
  @Get('admin')
  findAllAdmin() {
    return this.plansService.findAllAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard, AdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plansService.removeSoft(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard)
  @Post(':id/select')
  @ApiOperation({ summary: 'Kullanıcı için paket seçer' })
  selectPlan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.plansService.selectPlan(user.id, id);
  }
}
