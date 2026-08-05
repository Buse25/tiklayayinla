import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { parseCsvText, parseWorkbookBuffer } from '../parser';
import { createInitialMapping, parseLocalizedNumber } from '../normalizer';
import { validateImport } from '../validator';

test('Türkçe CSV başlıklarını ve boş satırları parse eder', () => {
  const parsed = parseCsvText('başlık;fiyat;şehir\nGüzel Daire;1.250.000;İstanbul\n;;\n', ';');
  assert.deepEqual(parsed.headers, ['başlık', 'fiyat', 'şehir']);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].values.başlık, 'Güzel Daire');
});

test('virgüllü CSV içinde quoted alanları güvenli parse eder', () => {
  const parsed = parseCsvText('"title","description","price"\n"Ev, deniz manzaralı","Uzun açıklama alanı", "1,250,000"', ',');
  assert.equal(parsed.rows[0].values.title, 'Ev, deniz manzaralı');
  assert.equal(parsed.rows[0].values.description, 'Uzun açıklama alanı');
});

test('XLSX workbook ilk sheet içeriğini parse eder', () => {
  const sheet = XLSX.utils.aoa_to_sheet([['title', 'price'], ['Daire', 1250000], ['', '']]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'İlanlar');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const parsed = parseWorkbookBuffer(buffer, 'ilanlar.xlsx');
  assert.equal(parsed.headers[0], 'title');
  assert.equal(parsed.rows.length, 1);
});

test('fiyat normalizasyonu Türkçe ve İngilizce biçimleri destekler', () => {
  assert.equal(parseLocalizedNumber('1.250.000'), 1250000);
  assert.equal(parseLocalizedNumber('1,250,000'), 1250000);
  assert.equal(parseLocalizedNumber('1250000'), 1250000);
  assert.equal(parseLocalizedNumber('1.250.000,50'), 1250000.5);
  assert.equal(parseLocalizedNumber('bozuk'), null);
});

test('zorunlu alan eksik ve bozuk fiyat hatalarını üretir', () => {
  const parsed = parseCsvText('title,description,price,currency,listingType,propertyType,city,district,address\nEv,Kısa,bozuk,TRY,SALE,APARTMENT,İstanbul,Kadıköy,\n', ',');
  const mapping = createInitialMapping(parsed.headers);
  const result = validateImport(parsed, mapping);
  assert.equal(result.summary.errorRows, 1);
  assert.ok(result.rows[0].issues.some((issue) => issue.code === 'INVALID_NUMBER'));
  assert.ok(result.rows[0].issues.some((issue) => issue.code === 'REQUIRED'));
});

test('duplicate referans numarasını uyarı olarak işaretler', () => {
  const parsed = parseCsvText('referenceNo,title,description,price,currency,listingType,propertyType,city,district,address\nR1,Deniz manzaralı daire,Merkezi konumda geniş açıklama,1250000,TRY,SALE,APARTMENT,İstanbul,Kadıköy,Adres\nR1,Bahçeli villa,Merkezi konumda geniş açıklama,2250000,TRY,SALE,VILLA,İstanbul,Beykoz,Adres\n', ',');
  const mapping = createInitialMapping(parsed.headers);
  const result = validateImport(parsed, mapping);
  assert.equal(result.summary.warningRows, 2);
  assert.equal(result.summary.payloadRows, 2);
});
