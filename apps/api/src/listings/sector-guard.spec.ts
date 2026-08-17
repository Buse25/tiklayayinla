import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { MembershipStatus, OrganizationType, UserRole } from '@prisma/client';
import { assertPropertySectorAccess, assertVehicleSectorAccess } from './sector-guard';

describe('assertPropertySectorAccess', () => {
  it('allows admin users for any sector', () => {
    expect(() => assertPropertySectorAccess({ role: UserRole.ADMIN, membershipStatus: MembershipStatus.PASSIVE, organizationType: OrganizationType.OTHER }, 'create')).not.toThrow();
  });

  it('blocks inactive organization members before sector checks', () => {
    try {
      assertPropertySectorAccess({ role: UserRole.USER, membershipStatus: MembershipStatus.PASSIVE, organizationType: OrganizationType.REAL_ESTATE_AGENCY }, 'publish');
      throw new Error('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'ORGANIZATION_NOT_APPROVED' });
    }
  });

  it('blocks AUTO_DEALER property operations with a 422 code', () => {
    try {
      assertPropertySectorAccess({ role: UserRole.USER, membershipStatus: MembershipStatus.ACTIVE, organizationType: OrganizationType.AUTO_DEALER }, 'import');
      throw new Error('expected UnprocessableEntityException');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toMatchObject({ code: 'AUTO_DEALER_VEHICLE_DOMAIN_PENDING' });
    }
  });

  it('blocks OTHER sector property operations with a 403 code', () => {
    try {
      assertPropertySectorAccess({ role: UserRole.USER, membershipStatus: MembershipStatus.ACTIVE, organizationType: OrganizationType.OTHER }, 'update');
      throw new Error('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'ORGANIZATION_SECTOR_NOT_SUPPORTED' });
    }
  });
});

describe('assertVehicleSectorAccess', () => {
  it('allows vehicle publish and republish for an active auto dealer', () => {
    const user = { role: UserRole.USER, membershipStatus: MembershipStatus.ACTIVE, organizationType: OrganizationType.AUTO_DEALER };
    expect(() => assertVehicleSectorAccess(user, 'publish')).not.toThrow();
    expect(() => assertVehicleSectorAccess(user, 'republish')).not.toThrow();
  });

  it('does not route vehicle publish through the property guard', () => {
    expect(() => assertVehicleSectorAccess({ role: UserRole.USER, membershipStatus: MembershipStatus.ACTIVE, organizationType: OrganizationType.REAL_ESTATE_AGENCY }, 'publish')).toThrow(ForbiddenException);
  });
});
