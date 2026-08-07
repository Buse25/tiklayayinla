import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAuditQueryParams, getAuditEntityLink, sanitizeAuditChanges, translateAuditAction } from '../audit-logs';

test('known audit actions are translated', () => {
  assert.equal(translateAuditAction('LISTING_CREATED'), 'İlan oluşturuldu');
  assert.equal(translateAuditAction('LISTING_PUBLISHED'), 'İlan yayınlandı');
});

test('unknown audit actions fall back to readable text', () => {
  assert.equal(translateAuditAction('SOMETHING_NEW_HAPPENED'), 'Something new happened');
});

test('sensitive audit fields are filtered or masked', () => {
  const changes = sanitizeAuditChanges({
    password: 'secret',
    token: 'abc',
    credential: 'hidden',
    vkn: '1234567890',
    phone: '+905551112233',
    title: 'İlan güncellendi',
  }) as Record<string, unknown>;
  assert.equal(Object.hasOwn(changes, 'password'), false);
  assert.equal(Object.hasOwn(changes, 'token'), false);
  assert.equal(Object.hasOwn(changes, 'credential'), false);
  assert.equal(changes.vkn, '******7890');
  assert.equal(changes.phone, '********2233');
  assert.equal(changes.title, 'İlan güncellendi');
});

test('entity links are generated safely', () => {
  assert.equal(getAuditEntityLink('LISTING', '11111111-1111-1111-1111-111111111111'), '/listings/11111111-1111-1111-1111-111111111111');
  assert.equal(getAuditEntityLink('ORGANIZATION', '33333333-3333-3333-3333-333333333333'), '/organization-applications');
});

test('unsupported entities do not generate broken links', () => {
  assert.equal(getAuditEntityLink('IMPORT_BATCH', 'not-a-link'), null);
});

test('query params are built from supported filters only', () => {
  const params = buildAuditQueryParams({ page: 2, limit: 10, action: 'LISTING_CREATED', entityType: 'LISTING', sortOrder: 'asc' });
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('limit'), '10');
  assert.equal(params.get('action'), 'LISTING_CREATED');
  assert.equal(params.get('entityType'), 'LISTING');
  assert.equal(params.get('sortOrder'), 'asc');
});
