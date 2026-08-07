import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateOrganizationApplicationDto } from './dto/create-organization-application.dto';
import { OrganizationApplicationResponseDto } from './dto/organization-application-response.dto';
import { ReviewOrganizationApplicationDto } from './dto/review-organization-application.dto';
import { EditOrganizationApplicationDto } from './dto/edit-organization-application.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('organizations/applications')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Kurumsal hesap başvurusu oluşturur' })
  @ApiCreatedResponse({ type: OrganizationApplicationResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Geçersiz kurum alanı.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationApplicationDto) {
    return this.organizations.createApplication(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Oturumdaki kullanıcının kurumsal başvurularını listeler' })
  @ApiOkResponse({ type: [OrganizationApplicationResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.listApplications(user.id);
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Tüm kurumsal başvuruları listeler (Admin-Only)' })
  @ApiOkResponse({ type: [OrganizationApplicationResponseDto] })
  listAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.listAllApplications(user.id, user.role);
  }

  @Get('admin/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Belirli bir kurumsal başvurunun detayını getirir (Admin-Only)' })
  @ApiOkResponse({ type: OrganizationApplicationResponseDto })
  getOneAdmin(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizations.getApplicationDetail(user.id, user.role, id);
  }

  @Patch(':id/approve')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Kurumsal başvuruyu onaylar' })
  @ApiOkResponse({ type: OrganizationApplicationResponseDto })
  @ApiForbiddenResponse({ description: 'Admin yetkisi gerekir.' })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizations.approveApplication(user.id, user.role, id);
  }

  @Patch(':id/reject')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Kurumsal başvuruyu reddeder' })
  @ApiOkResponse({ type: OrganizationApplicationResponseDto })
  @ApiForbiddenResponse({ description: 'Admin yetkisi gerekir.' })
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewOrganizationApplicationDto) {
    return this.organizations.rejectApplication(user.id, user.role, id, dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'PENDING durumundaki kurumsal başvuruyu düzenler (Admin-Only)' })
  @ApiOkResponse({ type: OrganizationApplicationResponseDto })
  @ApiForbiddenResponse({ description: 'Admin yetkisi gerekir.' })
  editAdmin(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EditOrganizationApplicationDto) {
    return this.organizations.editApplication(user.id, user.role, id, dto);
  }
}
