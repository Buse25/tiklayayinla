import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackendImportCsvFile, createBackendImportJsonFile, mapBackendRowToSourceRow, prepareBackendImportRows } from '../backend-adapter';
import type { ValidatedImportRow } from '../types';

function row(rowNumber: number, payload: ValidatedImportRow['payload']): ValidatedImportRow {
  return { rowNumber, source: {}, status: 'VALID', issues: [], payload };
}

test('frontend payload alanlarını backend snake_case import alanlarına dönüştürür', () => {
  const prepared = prepareBackendImportRows([
    row(7, {
      title: 'Deniz manzaralı daire',
      description: 'Merkezi konumda geniş açıklama alanı',
      price: 1250000,
      currency: 'TRY',
      listingType: 'SALE',
      propertyType: 'APARTMENT',
      city: 'İstanbul',
      district: 'Kadıköy',
      neighborhood: 'Moda',
      address: 'Moda Caddesi',
      residentialDetails: {
        grossArea: 120,
        netArea: 95,
        hasBalcony: true,
        heatingType: 'AIR_CONDITIONING',
      },
    }),
  ]);

  assert.equal(prepared.backendJson[0].listing_type, 'SALE');
  assert.equal(prepared.backendJson[0].property_type, 'APARTMENT');
  assert.equal(prepared.backendJson[0].gross_area, '120');
  assert.equal(prepared.backendJson[0].net_area, '95');
  assert.equal(prepared.backendJson[0].has_balcony, 'true');
  assert.equal(prepared.backendJson[0].heating_type, 'AIR_CONDITIONING');
  assert.deepEqual(prepared.mapping.find((item) => item.targetField === 'gross_area'), { sourceField: 'gross_area', targetField: 'gross_area', transformation: null });
});

test('backend tarafında kaydedilmeyen referans alanları için kullanıcı uyarısı üretir', () => {
  const prepared = prepareBackendImportRows([
    row(2, {
      title: 'Bahçeli villa',
      description: 'Aile yaşamına uygun geniş açıklama',
      price: 3000000,
      currency: 'TRY',
      listingType: 'SALE',
      propertyType: 'VILLA',
      city: 'İstanbul',
      district: 'Beykoz',
      address: 'Beykoz adres',
      externalId: 'EXT-1',
      referenceNo: 'REF-1',
    }),
  ]);

  assert.equal(prepared.unsupportedWarnings.length, 2);
  assert.ok(prepared.unsupportedWarnings.some((warning) => warning.includes('Harici ID')));
  assert.ok(prepared.unsupportedWarnings.some((warning) => warning.includes('Referans No')));
  assert.equal(prepared.backendJson[0].externalId, undefined);
  assert.equal(prepared.backendJson[0].referenceNo, undefined);
});

test('backend sıra numarasını kaynak dosyadaki satır numarasına eşler', () => {
  const prepared = prepareBackendImportRows([
    row(4, {
      title: 'İlk ilan',
      description: 'Yeterince uzun açıklama alanı',
      price: 1000000,
      currency: 'TRY',
      listingType: 'SALE',
      propertyType: 'APARTMENT',
      city: 'İzmir',
      district: 'Konak',
      address: 'Adres',
    }),
    row(9, {
      title: 'İkinci ilan',
      description: 'Yeterince uzun açıklama alanı',
      price: 2000000,
      currency: 'TRY',
      listingType: 'SALE',
      propertyType: 'APARTMENT',
      city: 'Ankara',
      district: 'Çankaya',
      address: 'Adres',
    }),
  ]);

  assert.equal(mapBackendRowToSourceRow(prepared, 1), 4);
  assert.equal(mapBackendRowToSourceRow(prepared, 2), 9);
});

test('backend JSON dosyasını güvenli application/json File olarak üretir', async () => {
  const file = createBackendImportJsonFile([{ title: 'Türkçe karakterli ilan' }]);
  assert.equal(file.name, 'tiklayayinla-import.json');
  assert.equal(file.type, 'application/json;charset=utf-8');
  assert.equal(await file.text(), '[{"title":"Türkçe karakterli ilan"}]');
});

test('backend CSV dosyasını UTF-8 BOM ve RFC uyumlu kaçışlarla üretir', async () => {
  const file = createBackendImportCsvFile([{ title: 'Ev; "deniz"\nmanzara', description: '=formül değil', price: '1250000', currency: 'TRY', listing_type: 'SALE', property_type: 'APARTMENT', city: 'İstanbul', district: 'Kadıköy', address: 'Adres' }]);
  const text = await file.text();
  assert.equal(file.name, 'tiklayayinla-import.csv');
  assert.equal(file.type, 'text/csv;charset=utf-8');
  assert.ok(text.includes('title;description;price;currency;listing_type;property_type'));
  assert.ok(text.includes('"Ev; ""deniz""\nmanzara"'));
  assert.ok(text.includes(";'=formül değil;"));
});
