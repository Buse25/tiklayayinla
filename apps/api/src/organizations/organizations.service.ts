import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, MembershipStatus, OrganizationApplicationStatus, OrganizationRole, OrganizationStatus, OrganizationType, Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { CreateOrganizationApplicationDto } from './dto/create-organization-application.dto';
import { OrganizationApplicationResponseDto } from './dto/organization-application-response.dto';
import { ReviewOrganizationApplicationDto } from './dto/review-organization-application.dto';
import { EditOrganizationApplicationDto } from './dto/edit-organization-application.dto';

const applicationInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.OrganizationApplicationInclude;
type ApplicationRecord = Prisma.OrganizationApplicationGetPayload<{ include: typeof applicationInclude }>;

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly mailService?: MailService) {}

  async createApplication(actor: Pick<AuthenticatedUser, 'id' | 'role'>, dto: CreateOrganizationApplicationDto): Promise<OrganizationApplicationResponseDto> {
    await this.ensureApplicationEligibility(actor, dto);
    const application = await this.prisma.organizationApplication.create({
      data: {
        userId: actor.id,
        organizationName: dto.organizationName,
        organizationType: dto.organizationType,
        country: dto.country,
        city: dto.city,
        district: dto.district,
        taxOffice: dto.taxOffice ?? undefined,
        vkn: dto.vkn ?? undefined,
        authorizedPersonName: dto.authorizedPersonName,
        companyPhone: dto.companyPhone ?? undefined,
        businessEmail: dto.businessEmail ?? undefined,
        address: dto.address,
        licenseNumber: this.normalizeLicenseNumber(dto.organizationType, dto.licenseNumber ?? null),
      },
      include: applicationInclude,
    });
    const response = toResponse(application);
    await this.audit.log({
      actorUserId: actor.id,
      action: AuditAction.ORGANIZATION_APPLICATION_CREATED,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: application.id,
      changes: { organizationType: application.organizationType, organizationName: application.organizationName, status: application.status },
    });
    void this.sendApplicationMail('created', application).catch((error) => this.logMailFailure('created', application, error));
    return response;
  }

  async listApplications(userId: string): Promise<OrganizationApplicationResponseDto[]> {
    const applications = await this.prisma.organizationApplication.findMany({
      where: { userId },
      include: applicationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return applications.map(toResponse);
  }

  async approveApplication(actorUserId: string, actorRole: UserRole, applicationId: string): Promise<OrganizationApplicationResponseDto> {
    this.ensureAdmin(actorRole);
    const application = await this.prisma.organizationApplication.findUnique({ where: { id: applicationId }, include: applicationInclude });
    if (!application) throw new NotFoundException('Kurumsal başvuru bulunamadı.');
    if (application.status !== OrganizationApplicationStatus.PENDING) throw new ConflictException('Sadece PENDING başvurular onaylanabilir.');

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationApplication.update({
        where: { id: applicationId },
        data: { status: OrganizationApplicationStatus.APPROVED, reviewedById: actorUserId, reviewedAt: new Date(), rejectionReason: null },
        include: applicationInclude,
      });
      const organization = await tx.organization.create({
        data: {
          name: updated.organizationName,
          type: updated.organizationType,
          country: updated.country,
          city: updated.city,
          district: updated.district,
          address: updated.address,
          phone: updated.companyPhone ?? undefined,
          taxNumber: updated.vkn ?? undefined,
          taxOffice: updated.taxOffice ?? undefined,
          businessEmail: updated.businessEmail ?? undefined,
          authorizedPersonName: updated.authorizedPersonName,
          licenseNumber: updated.licenseNumber ?? undefined,
          status: OrganizationStatus.ACTIVE,
        },
      });
      await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: updated.userId,
          role: OrganizationRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });
      return updated;
    });

    await this.audit.log({
      actorUserId,
      action: AuditAction.ORGANIZATION_APPLICATION_APPROVED,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: applicationId,
      changes: { organizationType: application.organizationType, organizationName: application.organizationName },
    });
    void this.sendApplicationMail('approved', result).catch((error) => this.logMailFailure('approved', result, error));

    return toResponse(result);
  }

  async rejectApplication(actorUserId: string, actorRole: UserRole, applicationId: string, dto: ReviewOrganizationApplicationDto): Promise<OrganizationApplicationResponseDto> {
    this.ensureAdmin(actorRole);
    const application = await this.prisma.organizationApplication.findUnique({ where: { id: applicationId }, include: applicationInclude });
    if (!application) throw new NotFoundException('Kurumsal başvuru bulunamadı.');
    if (application.status !== OrganizationApplicationStatus.PENDING) throw new ConflictException('Sadece PENDING başvurular reddedilebilir.');

    const updated = await this.prisma.organizationApplication.update({
      where: { id: applicationId },
      data: {
        status: OrganizationApplicationStatus.REJECTED,
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        rejectionReason: dto.rejectionReason ?? 'Başvuru reddedildi.',
      },
      include: applicationInclude,
    });

    await this.audit.log({
      actorUserId,
      action: AuditAction.ORGANIZATION_APPLICATION_REJECTED,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: applicationId,
      changes: { organizationType: updated.organizationType, organizationName: updated.organizationName, rejectionReason: updated.rejectionReason },
    });
    void this.sendApplicationMail('rejected', updated).catch((error) => this.logMailFailure('rejected', updated, error));

    return toResponse(updated);
  }

  async listAllApplications(actorUserId: string, actorRole: UserRole): Promise<OrganizationApplicationResponseDto[]> {
    this.ensureAdmin(actorRole);
    const applications = await this.prisma.organizationApplication.findMany({
      include: applicationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return applications.map(toResponse);
  }

  async getApplicationDetail(actorUserId: string, actorRole: UserRole, id: string): Promise<OrganizationApplicationResponseDto> {
    this.ensureAdmin(actorRole);
    const application = await this.prisma.organizationApplication.findUnique({
      where: { id },
      include: applicationInclude,
    });
    if (!application) throw new NotFoundException('Kurumsal başvuru bulunamadı.');
    return toResponse(application);
  }

  async editApplication(actorUserId: string, actorRole: UserRole, id: string, dto: EditOrganizationApplicationDto): Promise<OrganizationApplicationResponseDto> {
    this.ensureAdmin(actorRole);
    const application = await this.prisma.organizationApplication.findUnique({
      where: { id },
      include: applicationInclude,
    });
    if (!application) throw new NotFoundException('Kurumsal başvuru bulunamadı.');
    if (application.status !== OrganizationApplicationStatus.PENDING) {
      throw new ConflictException('Sadece PENDING durumundaki başvurular düzenlenebilir.');
    }

    const targetType = dto.organizationType ?? application.organizationType;
    const targetLicense = dto.licenseNumber !== undefined ? dto.licenseNumber : application.licenseNumber;
    const licenseNumber = this.normalizeLicenseNumber(targetType, targetLicense);

    const changedFields: string[] = [];
    const updateData: Prisma.OrganizationApplicationUpdateInput = {};

    if (dto.organizationName !== undefined && dto.organizationName !== application.organizationName) {
      changedFields.push('organizationName');
      updateData.organizationName = dto.organizationName;
    }
    if (dto.organizationType !== undefined && dto.organizationType !== application.organizationType) {
      changedFields.push('organizationType');
      updateData.organizationType = dto.organizationType;
    }
    if (dto.country !== undefined && dto.country !== application.country) {
      changedFields.push('country');
      updateData.country = dto.country;
    }
    if (dto.city !== undefined && dto.city !== application.city) {
      changedFields.push('city');
      updateData.city = dto.city;
    }
    if (dto.district !== undefined && dto.district !== application.district) {
      changedFields.push('district');
      updateData.district = dto.district;
    }
    if (dto.address !== undefined && dto.address !== application.address) {
      changedFields.push('address');
      updateData.address = dto.address;
    }
    if (dto.taxOffice !== undefined && dto.taxOffice !== application.taxOffice) {
      changedFields.push('taxOffice');
      updateData.taxOffice = dto.taxOffice;
    }
    if (dto.vkn !== undefined && dto.vkn !== application.vkn) {
      changedFields.push('vkn');
      updateData.vkn = dto.vkn;
    }
    if (dto.authorizedPersonName !== undefined && dto.authorizedPersonName !== application.authorizedPersonName) {
      changedFields.push('authorizedPersonName');
      updateData.authorizedPersonName = dto.authorizedPersonName;
    }
    if (dto.companyPhone !== undefined && dto.companyPhone !== application.companyPhone) {
      changedFields.push('companyPhone');
      updateData.companyPhone = dto.companyPhone;
    }
    if (dto.businessEmail !== undefined && dto.businessEmail !== application.businessEmail) {
      changedFields.push('businessEmail');
      updateData.businessEmail = dto.businessEmail;
    }

    if (targetType === OrganizationType.AUTO_DEALER) {
      if (dto.licenseNumber !== undefined && licenseNumber !== application.licenseNumber) {
        changedFields.push('licenseNumber');
        updateData.licenseNumber = licenseNumber;
      }
    } else {
      if (application.licenseNumber !== null) {
        changedFields.push('licenseNumber');
        updateData.licenseNumber = null;
      }
    }

    if (changedFields.length === 0) {
      return toResponse(application);
    }

    const updated = await this.prisma.organizationApplication.update({
      where: { id },
      data: updateData,
      include: applicationInclude,
    });

    await this.audit.log({
      actorUserId,
      action: AuditAction.ORGANIZATION_APPLICATION_EDITED,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: id,
      changes: { changedFields },
    });

    return toResponse(updated);
  }

  private async ensureApplicationEligibility(actor: Pick<AuthenticatedUser, 'id' | 'role'>, dto: CreateOrganizationApplicationDto): Promise<void> {
    if (actor.role === UserRole.ADMIN) return;

    if (dto.organizationType === OrganizationType.OTHER) {
      throw new ConflictException({ code: 'ORGANIZATION_TYPE_NOT_SUPPORTED', message: 'Diğer sektör için kurumsal başvuru oluşturulamaz.' });
    }

    const activeOwnerMembership = await this.prisma.organizationMembership.findFirst({
      where: { userId: actor.id, role: OrganizationRole.OWNER, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (activeOwnerMembership) {
      throw new ConflictException({ code: 'USER_ALREADY_HAS_ACTIVE_ORGANIZATION', message: 'Aktif OWNER üyeliğiniz bulunduğu için yeni kurumsal başvuru açılamaz.' });
    }

    const activeApplications = await this.prisma.organizationApplication.findMany({
      where: {
        userId: actor.id,
        status: { in: [OrganizationApplicationStatus.PENDING, OrganizationApplicationStatus.APPROVED] },
      },
      select: { status: true },
      orderBy: { createdAt: 'desc' },
    });
    if (activeApplications.some((application) => application.status === OrganizationApplicationStatus.PENDING)) {
      throw new ConflictException({ code: 'ORGANIZATION_APPLICATION_ALREADY_PENDING', message: 'Kurumsal başvurunuz incelemede.' });
    }
    if (activeApplications.some((application) => application.status === OrganizationApplicationStatus.APPROVED)) {
      throw new ConflictException({ code: 'ORGANIZATION_APPLICATION_ALREADY_APPROVED', message: 'Kurumsal hesabınız onaylandı.' });
    }

    const vkn = this.normalizeVkn(dto.vkn ?? null);
    const pending = await this.prisma.organizationApplication.findFirst({
      where: {
        userId: actor.id,
        status: OrganizationApplicationStatus.PENDING,
        ...(vkn ? { vkn } : {}),
        organizationType: dto.organizationType,
      },
      select: { id: true },
    });
    if (pending) throw new ConflictException({ code: 'ORGANIZATION_APPLICATION_ALREADY_PENDING', message: 'Kurumsal başvurunuz incelemede.' });
    if (vkn) {
      const duplicateVkn = await this.prisma.organizationApplication.findFirst({
        where: { vkn, status: { in: [OrganizationApplicationStatus.PENDING, OrganizationApplicationStatus.APPROVED] } },
        select: { id: true },
      });
      if (duplicateVkn) throw new ConflictException({ code: 'ORGANIZATION_APPLICATION_ALREADY_PENDING', message: 'Bu VKN ile aktif kurumsal başvuru zaten mevcut.' });
    }
  }

  private ensureAdmin(role: UserRole): void {
    if (role !== UserRole.ADMIN) throw new ForbiddenException('Bu işlem için admin yetkisi gerekir.');
  }

  private normalizeLicenseNumber(organizationType: OrganizationType, licenseNumber: string | null): string | undefined {
    if (organizationType !== OrganizationType.AUTO_DEALER) return undefined;
    const normalized = licenseNumber?.trim();
    if (!normalized) throw new ConflictException({ code: 'ORGANIZATION_LICENSE_NUMBER_REQUIRED', message: 'Motorlu Kara Taşıtı Ticareti Yetki Belge No zorunludur.' });
    return normalized;
  }

  private normalizeVkn(vkn: string | null): string | null {
    const normalized = vkn?.trim() ?? null;
    return normalized === '' ? null : normalized;
  }

  private async sendApplicationMail(kind: 'created' | 'approved' | 'rejected', application: ApplicationRecord): Promise<void> {
    if (!this.mailService) return;
    const recipient = application.user.email;
    const base = {
      to: recipient,
      organizationName: application.organizationName,
      userName: [application.user.firstName, application.user.lastName].filter(Boolean).join(' ').trim() || undefined,
      rejectionReason: application.rejectionReason ?? null,
    };

    if (kind === 'created') {
      await this.mailService.sendOrganizationApplicationCreated(base);
    } else if (kind === 'approved') {
      await this.mailService.sendOrganizationApplicationApproved(base);
    } else {
      await this.mailService.sendOrganizationApplicationRejected(base);
    }
  }

  private async logMailFailure(kind: 'created' | 'approved' | 'rejected', application: ApplicationRecord, error: unknown): Promise<void> {
    await this.audit.log({
      actorUserId: application.userId,
      action: AuditAction.MAIL_DELIVERY_FAILED,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: application.id,
      changes: {
        template: `organization-application-${kind}`,
        organizationName: application.organizationName,
        email: maskEmail(application.user.email),
        reason: serializeError(error),
      },
    });
    this.logger.warn({ event: 'organization_mail_delivery_failed', kind, applicationId: application.id, email: maskEmail(application.user.email) });
  }
}

function toResponse(application: ApplicationRecord): OrganizationApplicationResponseDto {
  return {
    id: application.id,
    userId: application.userId,
    organizationName: application.organizationName,
    organizationType: application.organizationType,
    country: application.country,
    city: application.city,
    district: application.district,
    taxOffice: application.taxOffice,
    vkn: application.vkn,
    authorizedPersonName: application.authorizedPersonName,
    companyPhone: application.companyPhone,
    businessEmail: application.businessEmail,
    address: application.address,
    licenseNumber: application.licenseNumber,
    status: application.status,
    rejectionReason: application.rejectionReason,
    reviewedById: application.reviewedById,
    reviewedAt: application.reviewedAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

function maskEmail(email: string): string {
  const [localPart, domain = ''] = email.split('@');
  const maskedLocal = localPart.length <= 2 ? `${localPart[0] ?? '*'}*` : `${localPart[0]}***${localPart.at(-1)}`;
  const [host, ...rest] = domain.split('.');
  const maskedHost = host.length <= 2 ? `${host[0] ?? '*'}*` : `${host[0]}***${host.at(-1)}`;
  return `${maskedLocal}@${[maskedHost, ...rest].filter(Boolean).join('.')}`;
}

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 120);
  return String(error).slice(0, 120);
}
