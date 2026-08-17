import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canStartEidsAuthorization, getEidsCardState } from '../profile-summary';

test('EİDS kartı gerçek identity state değerlerini gösterir', () => {
  const base = { configured: false, status: 'NOT_VERIFIED', verified: false, verifiedAt: null, verificationMethod: null } as const;
  assert.equal(getEidsCardState(base, true).showAction, false);
  assert.match(getEidsCardState(base, true).message, /kullanıma hazır değil/);
  assert.match(getEidsCardState({ ...base, configured: true }, false, null, false).message, /telefon numaranızı ekleyin/);
  assert.match(getEidsCardState({ ...base, configured: true }, false, null, true).message, /telefon numaranızı doğrulayın/);
  assert.match(getEidsCardState({ ...base, configured: true }, false).message, /telefon/);
  assert.equal(getEidsCardState({ ...base, configured: true, status: 'PENDING' }, true, 'OTP').tone, 'warning');
  assert.equal(getEidsCardState({ ...base, configured: true, status: 'VERIFIED', verified: true, verificationMethod: 'EIDS', verifiedAt: '2026-08-13T10:00:00.000Z' }, true, 'OTP').tone, 'success');
  assert.equal(getEidsCardState({ ...base, configured: true, status: 'VERIFIED', verified: true, verificationMethod: 'ADMIN_TEST' }, true, 'OTP').message, 'Test doğrulaması.');
  assert.equal(getEidsCardState({ ...base, configured: true, status: 'FAILED' }, true, 'OTP').tone, 'error');
  assert.equal(canStartEidsAuthorization({ ...base, configured: true }, true, 'ADMIN'), false);
  assert.equal(canStartEidsAuthorization({ ...base, configured: true }, true, 'OTP'), true);
});
