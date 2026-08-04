import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeatureCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateListingDto } from '../dto/create-listing.dto';
import type { CsvRecord } from './csv-listing-parser.service';
import type { ListingImportErrorDto } from './dto/listing-import.dto';

export type ValidImportRow = { row: number; dto: CreateListingDto; summary: { row: number; title: string; city: string; district: string; price: number; currency: string } };
const featureFields: Array<[keyof CsvRecord, keyof CreateListingDto, FeatureCategory]> = [['facades', 'facades', FeatureCategory.FACADE], ['interior_features', 'interiorFeatures', FeatureCategory.INTERIOR], ['exterior_features', 'exteriorFeatures', FeatureCategory.EXTERIOR], ['nearby_places', 'nearbyPlaces', FeatureCategory.NEARBY], ['transportation', 'transportation', FeatureCategory.TRANSPORTATION], ['views', 'views', FeatureCategory.VIEW], ['accessibility_features', 'accessibilityFeatures', FeatureCategory.ACCESSIBILITY]];

@Injectable()
export class CsvListingValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  async validateRows(rows: Array<{ row: number; values: CsvRecord }>): Promise<{ validRows: ValidImportRow[]; errors: ListingImportErrorDto[]; duplicateRows: number }> {
    const featureMap = new Map((await this.prisma.featureDefinition.findMany({ where: { isActive: true }, select: { code: true, category: true } })).map((feature) => [feature.code, feature.category]));
    const validRows: ValidImportRow[] = []; const errors: ListingImportErrorDto[] = []; const duplicates = new Set<string>(); let duplicateRows = 0;
    for (const row of rows) {
      const result = await this.validateRow(row.row, row.values, featureMap);
      if ('errors' in result) { errors.push(...result.errors); continue; }
      const key = [result.dto.listingType, result.dto.propertyType, result.dto.city.toLocaleLowerCase('tr'), result.dto.district.toLocaleLowerCase('tr'), result.dto.address.toLocaleLowerCase('tr'), result.dto.title.toLocaleLowerCase('tr'), result.dto.price].join('|');
      if (duplicates.has(key)) { duplicateRows++; errors.push(error(row.row, 'title', 'DUPLICATE_ROW', 'Aynı dosya içinde tekrar eden ilan.', row.values.title)); continue; }
      duplicates.add(key); validRows.push(result);
    }
    return { validRows, errors, duplicateRows };
  }

  private async validateRow(row: number, values: CsvRecord, featureMap: Map<string, FeatureCategory>): Promise<ValidImportRow | { errors: ListingImportErrorDto[] }> {
    const errors: ListingImportErrorDto[] = [];
    const number = (column: string, integer = false): number | undefined => {
      const value = values[column]?.trim(); if (!value) return undefined;
      if (!/^-?\d+(\.\d+)?$/.test(value)) { errors.push(error(row, column, 'INVALID_NUMBER', 'Geçerli sayı bekleniyor.', value)); return undefined; }
      const parsed = Number(value); if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) { errors.push(error(row, column, 'INVALID_NUMBER', integer ? 'Tam sayı bekleniyor.' : 'Geçerli sayı bekleniyor.', value)); return undefined; }
      return parsed;
    };
    const bool = (column: string): boolean | undefined => { const value = values[column]?.trim(); if (!value) return undefined; if (value === 'true') return true; if (value === 'false') return false; errors.push(error(row, column, 'INVALID_BOOLEAN', 'true veya false bekleniyor.', value)); return undefined; };
    const list = (column: string) => values[column]?.split('|').map((value) => value.trim().toUpperCase()).filter(Boolean) ?? [];
    const dto: Record<string, unknown> = {
      title: values.title?.trim(), description: values.description?.trim(), price: number('price'), currency: values.currency?.trim().toUpperCase(), listingType: values.listing_type?.trim().toUpperCase(), propertyType: values.property_type?.trim().toUpperCase(), city: values.city?.trim(), district: values.district?.trim(), neighborhood: values.neighborhood?.trim() || undefined, address: values.address?.trim(), latitude: number('latitude'), longitude: number('longitude'),
    };
    const residentialDetails: Record<string, unknown> = { grossArea: number('gross_area'), netArea: number('net_area'), roomCount: values.room_count?.trim() || undefined, buildingAge: number('building_age', true), floorNumber: number('floor_number', true), totalFloors: number('total_floors', true), heatingType: values.heating_type?.trim().toUpperCase() || undefined, bathroomCount: number('bathroom_count', true), kitchenType: values.kitchen_type?.trim().toUpperCase() || undefined, hasBalcony: bool('has_balcony'), hasElevator: bool('has_elevator'), parkingType: values.parking_type?.trim().toUpperCase() || undefined, isFurnished: bool('is_furnished'), occupancyStatus: values.occupancy_status?.trim().toUpperCase() || undefined, isInComplex: bool('is_in_complex'), complexName: values.complex_name?.trim() || undefined, monthlyFee: number('monthly_fee'), isCreditEligible: bool('is_credit_eligible'), energyCertificate: values.energy_certificate?.trim().toUpperCase() || undefined, titleDeedStatus: values.title_deed_status?.trim().toUpperCase() || undefined, advertiserType: values.advertiser_type?.trim().toUpperCase() || undefined, isExchangeAccepted: bool('is_exchange_accepted'), housingType: values.housing_type?.trim().toUpperCase() || undefined };
    if (Object.values(residentialDetails).some((value) => value !== undefined)) dto.residentialDetails = residentialDetails;
    for (const [column, property, category] of featureFields) { const codes = list(column); dto[property] = codes; for (const code of codes) if (featureMap.get(code) !== category) errors.push(error(row, String(column), 'INVALID_FEATURE_CODE', 'Aktif ve doğru kategoriye ait feature code bekleniyor.', code)); }
    const gross = residentialDetails.grossArea as number | undefined; const net = residentialDetails.netArea as number | undefined;
    if (gross !== undefined && net !== undefined && net > gross) errors.push(error(row, 'net_area', 'AREA_ORDER_INVALID', 'net_area gross_area değerinden büyük olamaz.', String(net)));
    if (residentialDetails.isInComplex === false && residentialDetails.complexName) errors.push(error(row, 'complex_name', 'COMPLEX_NAME_NOT_ALLOWED', 'is_in_complex false iken complex_name boş olmalı.', String(residentialDetails.complexName)));
    const instance = plainToInstance(CreateListingDto, dto);
    for (const issue of await validate(instance, { whitelist: true, forbidNonWhitelisted: true })) errors.push(...dtoErrors(row, issue, values));
    if (errors.length) return { errors };
    const typed = instance as CreateListingDto;
    return { row, dto: typed, summary: { row, title: typed.title, city: typed.city, district: typed.district, price: typed.price, currency: typed.currency } };
  }
}

function error(row: number, column: string, code: string, message: string, value: string | null | undefined): ListingImportErrorDto { return { row, column, code, message, value: value ? escapeFormula(value) : null }; }
function camelToSnake(value: string): string { return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`); }
function escapeFormula(value: string): string { return /^[=+\-@]/.test(value) ? `'${value}` : value; }
function dtoErrors(row: number, issue: { property: string; constraints?: Record<string, string>; children?: Array<unknown> }, values: CsvRecord): ListingImportErrorDto[] {
  const children = (issue.children ?? []) as Array<{ property: string; constraints?: Record<string, string>; children?: Array<unknown> }>;
  if (!issue.constraints && children.length) return children.flatMap((child) => dtoErrors(row, child, values));
  const column = camelToSnake(issue.property);
  return [error(row, column, 'DTO_VALIDATION', Object.values(issue.constraints ?? {})[0] ?? 'Alan geçersiz.', values[column] ?? null)];
}
