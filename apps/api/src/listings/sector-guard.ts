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
    let message = 'Bu hesap türü ile bu işlemi gerçekleştiremezsiniz.';
    if (operation === 'create') {
      message = 'Bu hesap türü ile gayrimenkul ilanı oluşturamazsınız.';
    } else if (operation === 'import') {
      message = 'Bu hesap türü ile gayrimenkul ilanı içe aktaramazsınız.';
    } else if (operation === 'update') {
      message = 'Bu hesap türü ile gayrimenkul ilanını düzenleyemezsiniz.';
    } else if (operation === 'remove') {
      message = 'Bu hesap türü ile gayrimenkul ilanını silemezsiniz.';
    }
    throw new UnprocessableEntityException({
      code: 'AUTO_DEALER_VEHICLE_DOMAIN_PENDING',
      message,
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

export type VehicleSectorOperation = 'create' | 'update' | 'status' | 'remove';

export function assertVehicleSectorAccess(
  user: Pick<AuthenticatedUser, 'organizationType' | 'membershipStatus' | 'role' | 'organizationApplicationStatus'>,
  operation: VehicleSectorOperation,
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

  if (user.organizationType === OrganizationType.AUTO_DEALER) return;

  throw new ForbiddenException({
    code: 'ORGANIZATION_SECTOR_NOT_SUPPORTED',
    message: 'Bu işlem araç ilan yetkisi gerektirir.',
  });
}
