import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canUsePropertyListings, sectorLabel, sectorRestrictionMessage } from '../sector';

test('real estate agencies can use property listings', () => {
  assert.equal(canUsePropertyListings('REAL_ESTATE_AGENCY'), true);
  assert.equal(sectorRestrictionMessage('REAL_ESTATE_AGENCY'), '');
});

test('auto dealers are blocked until the vehicle domain is ready', () => {
  assert.equal(canUsePropertyListings('AUTO_DEALER'), false);
  assert.match(sectorRestrictionMessage('AUTO_DEALER'), /araç domaini/i);
});

test('other sectors are blocked with a generic message', () => {
  assert.equal(canUsePropertyListings('OTHER'), false);
  assert.match(sectorRestrictionMessage('OTHER'), /desteklenmiyor/i);
});

test('labels remain readable for UI banners', () => {
  assert.equal(sectorLabel(null), 'Bireysel hesap');
  assert.equal(sectorLabel('REAL_ESTATE_AGENCY'), 'Emlak Ofisi');
  assert.equal(sectorLabel('AUTO_DEALER'), 'Galeri / Otomotiv');
});
