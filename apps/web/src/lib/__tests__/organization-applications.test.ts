import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLicenseNumberRequirement, getOrganizationApplicationStatusBadge, getOrganizationApplicationViewState, normalizeApplicationLicenseNumber } from '../organization-applications';

test('real estate selection hides the license number field', () => {
  const requirement = getLicenseNumberRequirement('REAL_ESTATE_AGENCY');
  assert.equal(requirement.visible, false);
  assert.equal(requirement.required, false);
});

test('auto dealer selection shows a required license number field', () => {
  const requirement = getLicenseNumberRequirement('AUTO_DEALER');
  assert.equal(requirement.visible, true);
  assert.equal(requirement.required, true);
  assert.equal(requirement.label, 'Motorlu Kara Taşıtı Ticareti Yetki Belge No');
});

test('real estate payload strips license number values', () => {
  assert.equal(normalizeApplicationLicenseNumber('REAL_ESTATE_AGENCY', 'EIDS-123'), undefined);
});

test('pending and approved applications hide the form with the right badge', () => {
  const pending = getOrganizationApplicationViewState([{ id: '1', userId: 'user-1', organizationName: 'A', organizationType: 'REAL_ESTATE_AGENCY', city: 'B', district: 'C', status: 'PENDING', reviewedAt: null, createdAt: '2026-08-06T10:00:00.000Z' }]);
  const approved = getOrganizationApplicationViewState([{ id: '1', userId: 'user-1', organizationName: 'A', organizationType: 'REAL_ESTATE_AGENCY', city: 'B', district: 'C', status: 'APPROVED', reviewedAt: null, createdAt: '2026-08-06T10:00:00.000Z' }]);
  assert.equal(pending.kind, 'pending');
  assert.equal(pending.badge, 'İncelemede');
  assert.equal(approved.kind, 'approved');
  assert.equal(approved.badge, 'Onaylandı');
});

test('rejected applications expose the rejection reason and badge', () => {
  const state = getOrganizationApplicationViewState([{ id: '1', userId: 'user-1', organizationName: 'A', organizationType: 'REAL_ESTATE_AGENCY', city: 'B', district: 'C', status: 'REJECTED', rejectionReason: 'Eksik belge', reviewedAt: null, createdAt: '2026-08-06T10:00:00.000Z' }]);
  assert.equal(state.kind, 'rejected');
  assert.equal(state.badge, 'Reddedildi');
  assert.equal(state.rejectionReason, 'Eksik belge');
});

test('badge text is human readable for profile link', () => {
  assert.equal(getOrganizationApplicationStatusBadge(undefined), 'Başvur');
  assert.equal(getOrganizationApplicationStatusBadge('PENDING'), 'İncelemede');
  assert.equal(getOrganizationApplicationStatusBadge('APPROVED'), 'Onaylandı');
  assert.equal(getOrganizationApplicationStatusBadge('REJECTED'), 'Reddedildi');
});
