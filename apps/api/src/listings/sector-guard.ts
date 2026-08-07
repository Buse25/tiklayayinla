import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { MembershipStatus, OrganizationApplicationStatus, OrganizationType, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

type PropertySectorOperation = 'create' | 'update' | 'status' | 'remove' | 'import' | 'publish' | 'republish' | 'media';

export function assertPropertySectorAccess(
  user: Pick<AuthenticatedUser, 'organizationType' | 'membershipStatus' | 'role' | 'organizationApplicationStatus'>,
  operation: PropertySectorOperation,
): void {
  if (user.role === UserRole.ADMIN) return;

  if (
    user.organizationApplicationStatus === OrganizationApplicationStatus.PENDING ||
    user.organizationApplicationStatus === OrganizationApplicationStatus.REJECTED
  ) {
    throw new ForbiddenException({ code: 'ORGANIZATION_NOT_APPROVED', message: 'Kurumsal hesap onay bekliyor veya reddedilmiş.' });
  }

  if (user.membershipStatus && user.membershipStatus !== MembershipStatus.ACTIVE) {
    throw new ForbiddenException({ code: 'ORGANIZATION_NOT_APPROVED', message: 'Kurumsal hesap aktif değil.' });
  }

  if (!user.organizationType || user.organizationType === OrganizationType.REAL_ESTATE_AGENCY) return;

  if (user.organizationType === OrganizationType.AUTO_DEALER) {
    throw new UnprocessableEntityException({
      code: 'AUTO_DEALER_VEHICLE_DOMAIN_PENDING',
      message: `AUTO_DEALER hesabı ${operation} işlemi için araç domaini aktif olmadan property ilan akışını kullanamaz.`,
    });
  }

  throw new ForbiddenException({
    code: 'ORGANIZATION_SECTOR_NOT_SUPPORTED',
    message: `Organization sector ${user.organizationType} bu property ${operation} akışında desteklenmiyor.`,
  });
}

export function propertySectorLabel(user: Pick<AuthenticatedUser, 'organizationType'>): string {
  if (!user.organizationType) return 'INDIVIDUAL';
  return user.organizationType;
}
