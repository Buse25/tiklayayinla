import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatListingActivityChanges,
  formatListingDetailValue,
  getListingStatusLabel,
  getListingTypeLabel,
  getOccupancyStatusLabel,
  getParkingTypeLabel,
  getPropertyTypeLabel,
  getPublicationLinkState,
  getTitleDeedStatusLabel,
  translateListingActivityAction,
} from '../listing-display-labels';

test('listing enums are translated to Turkish labels', () => {
  assert.equal(getListingTypeLabel('RENT'), 'Kiralık');
  assert.equal(getPropertyTypeLabel('APARTMENT'), 'Daire');
  assert.equal(getListingStatusLabel('ACTIVE'), 'Aktif');
  assert.equal(getOccupancyStatusLabel('VACANT'), 'Boş');
  assert.equal(getTitleDeedStatusLabel('OWNERSHIP'), 'Kat Mülkiyeti');
});

test('kitchen and parking labels do not mix', () => {
  assert.equal(formatListingDetailValue('kitchenType', 'OPEN'), 'Açık Mutfak');
  assert.equal(formatListingDetailValue('parkingType', 'OPEN'), 'Açık Otopark');
  assert.equal(getParkingTypeLabel('OPEN'), 'Açık Otopark');
});

test('listing activity actions and metadata are translated', () => {
  assert.equal(translateListingActivityAction('LISTING_PUBLISHED'), 'İlan yayınlandı');
  const summary = formatListingActivityChanges({
    jobsCreated: 2,
    portalAccountCount: 3,
    fields: ['title', 'description', 'listingType', 'propertyType', 'city', 'district', 'address'],
    status: 'ACTIVE',
    previousStatus: 'DRAFT',
    newStatus: 'ARCHIVED',
  });
  assert.ok(summary.some((line) => line === 'Oluşturulan yayın görevi: 2'));
  assert.ok(summary.some((line) => line === 'Portal hesabı sayısı: 3'));
  assert.ok(summary.some((line) => line === 'Doldurulan alanlar: Başlık, Açıklama, İlan Tipi, Gayrimenkul Tipi, Şehir, İlçe, Açık Adres'));
  assert.ok(summary.some((line) => line === 'Durum: Aktif'));
  assert.ok(summary.some((line) => line === 'Önceki durum: Taslak'));
  assert.ok(summary.some((line) => line === 'Yeni durum: Arşivlendi'));
});

test('publication links stay safe for test hosts', () => {
  const state = getPublicationLinkState('https://mock-rest.local/listings/123');
  assert.equal(state.href, null);
  assert.equal(state.badge, 'Test portalı');
  assert.equal(state.label, 'Test yayını oluşturuldu');
});

test('real http links remain clickable', () => {
  const state = getPublicationLinkState('https://example.com/listings/123');
  assert.equal(state.href, 'https://example.com/listings/123');
  assert.equal(state.badge, null);
  assert.equal(state.label, 'Portalda Aç');
});
