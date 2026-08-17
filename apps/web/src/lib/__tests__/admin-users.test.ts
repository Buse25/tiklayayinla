import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canManuallyVerifyPhone, phoneVerificationMethodLabel, verificationLabel } from '../admin-users';

describe('admin user verification helpers', () => {
  it('formats verification badges', () => {
    assert.equal(verificationLabel(true), 'Doğrulandı');
    assert.equal(verificationLabel(false), 'Doğrulanmadı');
  });

  it('only allows manual phone verification for users with an unverified phone', () => {
    assert.equal(canManuallyVerifyPhone({ phone: '+905551112233', phoneVerified: false }), true);
    assert.equal(canManuallyVerifyPhone({ phone: null, phoneVerified: false }), false);
    assert.equal(canManuallyVerifyPhone({ phone: '+905551112233', phoneVerified: true }), false);
  });

  it('labels phone verification methods', () => {
    assert.equal(phoneVerificationMethodLabel('ADMIN'), 'Admin');
    assert.equal(phoneVerificationMethodLabel('OTP'), 'SMS OTP');
  });
});
