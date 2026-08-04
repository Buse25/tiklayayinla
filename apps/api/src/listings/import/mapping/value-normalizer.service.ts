import { Injectable } from '@nestjs/common';
import { normalize } from './field-mapping.service';

@Injectable()
export class ValueNormalizerService {
  transform(target: string, raw: string): Record<string, string> {
    const value = raw.trim(); if (!value) return {};
    if (target === 'price') { const parsed = money(value); return { price: parsed.amount, ...(parsed.currency ? { currency: parsed.currency } : {}) }; }
    if (target === 'listing_type') return { listing_type: enumValue(value, { satilik: 'SALE', satis: 'SALE', kiralik: 'RENT', kira: 'RENT' }) };
    if (target === 'property_type') return { property_type: enumValue(value, { daire: 'APARTMENT', villa: 'VILLA', 'mustakil ev': 'HOUSE' }) };
    if (target === 'housing_type') return { housing_type: enumValue(value, { daire: 'APARTMENT', villa: 'VILLA', 'mustakil ev': 'DETACHED_HOUSE', residence: 'RESIDENCE', yazlik: 'SUMMER_HOUSE', dubleks: 'DUPLEX', penthouse: 'PENTHOUSE', studyo: 'STUDIO' }) };
    if (target === 'heating_type') return { heating_type: enumValue(value, { kombi: 'COMBI_BOILER', 'merkezi sistem': 'CENTRAL', 'yerden isitma': 'UNDERFLOOR' }) };
    if (target === 'kitchen_type') return { kitchen_type: enumValue(value, { 'acik mutfak': 'OPEN', amerikan: 'AMERICAN', 'kapali mutfak': 'CLOSED' }) };
    if (target === 'parking_type') return { parking_type: enumValue(value, { 'kapali otopark': 'COVERED', 'acik otopark': 'OPEN' }) };
    if (target === 'occupancy_status') return { occupancy_status: enumValue(value, { bos: 'VACANT', 'ev sahibi oturuyor': 'OWNER_OCCUPIED', kiracili: 'TENANT_OCCUPIED' }) };
    if (target === 'title_deed_status') return { title_deed_status: enumValue(value, { 'kat mulkiyetli': 'OWNERSHIP', 'kat irtifakli': 'CONDOMINIUM_EASEMENT' }) };
    if (target === 'advertiser_type') return { advertiser_type: enumValue(value, { 'emlak ofisinden': 'AGENCY', sahibinden: 'OWNER' }) };
    if (target.startsWith('has_') || target.startsWith('is_')) return { [target]: booleanValue(value) };
    if (target === 'gross_area' || target === 'net_area') return { [target]: area(value) };
    if (target === 'monthly_fee') return { monthly_fee: numeric(value) };
    if (['facades', 'interior_features', 'exterior_features', 'nearby_places', 'transportation', 'views', 'accessibility_features'].includes(target)) return { [target]: featureValues(value).join('|') };
    return { [target]: value };
  }
}
function enumValue(value: string, map: Record<string, string>): string { return map[normalize(value)] ?? value.trim().toUpperCase().replace(/\s+/g, '_'); }
function booleanValue(value: string): string { const normalized = normalize(value); if (['evet', 'var', '1', 'true'].includes(normalized)) return 'true'; if (['hayir', 'yok', '0', 'false'].includes(normalized)) return 'false'; return value; }
function money(value: string): { amount: string; currency?: string } { const currency = /(?:tl|₺)/i.test(value) ? 'TRY' : /(?:usd|\$)/i.test(value) ? 'USD' : /(?:eur|€)/i.test(value) ? 'EUR' : undefined; return { amount: numeric(value), currency }; }
function area(value: string): string { return numeric(value.replace(/m²|m2/gi, '')); }
function numeric(value: string): string {
  const cleaned = value.replace(/[^0-9,.-]/g, ''); const commaCount = (cleaned.match(/,/g) ?? []).length; const dotCount = (cleaned.match(/\./g) ?? []).length;
  if (commaCount && dotCount) return cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  if (commaCount > 1 || dotCount > 1) return cleaned.replace(/[,.]/g, '');
  if (commaCount === 1) return cleaned.split(',')[1].length === 3 ? cleaned.replace(',', '') : cleaned.replace(',', '.');
  if (dotCount === 1 && cleaned.split('.')[1].length === 3) return cleaned.replace('.', '');
  return cleaned;
}
function featureValues(value: string): string[] { const map: Record<string, string> = { guney: 'SOUTH', dogu: 'EAST', kuzey: 'NORTH', bati: 'WEST', metro: 'METRO', 'otobus duragi': 'BUS_STOP' }; return value.split(/[|,;]/).map((item) => map[normalize(item)] ?? item.trim().toUpperCase().replace(/\s+/g, '_')).filter(Boolean); }
