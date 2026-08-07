import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canApproveOrganizationApplication,
  canRejectOrganizationApplication,
  getOrganizationApplicationLicenseRequirement,
  maskOrganizationVkn,
  validateRejectionReason,
} from '../organization-applications-admin';

test('pending applications can be approved', () => {
  assert.equal(canApproveOrganizationApplication('PENDING'), true);
});

test('approved applications cannot be approved again', () => {
  assert.equal(canApproveOrganizationApplication('APPROVED'), false);
});

test('rejected applications cannot be rejected again', () => {
  assert.equal(canRejectOrganizationApplication('REJECTED'), false);
});

test('vkn is masked in the admin ui', () => {
  assert.equal(maskOrganizationVkn('1234567890'), '******7890');
});

test('real estate applications hide the license field while auto dealer applications show it', () => {
  assert.equal(getOrganizationApplicationLicenseRequirement('REAL_ESTATE_AGENCY').visible, false);
  assert.equal(getOrganizationApplicationLicenseRequirement('AUTO_DEALER').visible, true);
});

test('rejection reason is required and should be descriptive', () => {
  assert.equal(validateRejectionReason(''), 'Red nedeni zorunludur.');
  assert.equal(validateRejectionReason('kısa'), 'Red nedeni en az 10 karakter olmalıdır.');
  assert.equal(validateRejectionReason('Belgeler eksik olduğu için reddedildi.'), null);
});
