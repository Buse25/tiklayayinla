import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProfileOrganizationSummary, getEidsInformationMessage, getProfileNavigationLinks } from '../profile-summary';

test('profile summary includes organization account information', () => {
  const summary = buildProfileOrganizationSummary({
    role: 'USER',
    organization: {
      organizationId: '1',
      organizationName: 'Yılmaz Gayrimenkul',
      organizationType: 'REAL_ESTATE_AGENCY',
      membershipRole: 'OWNER',
      membershipStatus: 'ACTIVE',
    },
  }, [{
    id: 'app-1',
    userId: 'user-1',
    organizationName: 'Yılmaz Gayrimenkul',
    organizationType: 'REAL_ESTATE_AGENCY',
    country: 'Türkiye',
    city: 'Bursa',
    district: 'Osmangazi',
    authorizedPersonName: 'Ahmet Yılmaz',
    address: 'Adres',
    status: 'APPROVED',
    reviewedAt: '2026-08-06T08:00:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
    updatedAt: '2026-08-06T08:00:00.000Z',
  }]);
  assert.equal(summary.accountStatus, 'Aktif kurumsal hesap');
  assert.equal(summary.organizationName, 'Yılmaz Gayrimenkul');
  assert.equal(summary.organizationType, 'Emlak Ofisi');
  assert.equal(summary.organizationRole, 'Yetkili');
  assert.equal(summary.applicationStatus, 'Onaylandı');
  assert.match(summary.approvalDate, /2026/);
});

test('admin navigation is visible only for admin users', () => {
  assert.equal(getProfileNavigationLinks('USER').some((link) => link.href === '/admin/organization-applications'), false);
  assert.equal(getProfileNavigationLinks('ADMIN').some((link) => link.href === '/admin/organization-applications'), true);
});

test('eids information is a passive info card only', () => {
  assert.equal(getEidsInformationMessage(), 'EİDS kullanıcı doğrulama altyapısı henüz yapılandırılmadı.');
});
