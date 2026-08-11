import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AuditAction, AuditEntityType, FeatureCategory, HousingType, Listing, ListingStatus, Prisma, PropertyType, PublicationStatus, UserRole, ListingDomain, FuelType, TransmissionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { CreateVehicleListingDto } from './dto/create-vehicle-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings-query.dto';
import { ListingResponseDto, ListingsPageResponseDto } from './dto/listing-response.dto';
import { ResidentialDetailsDto } from './dto/residential-details.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateVehicleListingDto } from './dto/update-vehicle-listing.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';
import { UpdateListingResponseDto } from './dto/update-listing-response.dto';
import { AuditService } from '../audit/audit.service';
import { assertPropertySectorAccess, assertVehicleSectorAccess } from './sector-guard';
import { getCanonicalVehicleBrand, getCanonicalVehicleModel, isHousingTypeCompatible, isValidVehicleBrandModel } from '@tiklayayinla/shared-types';
import { isValidTurkeyCity, isValidTurkeyCityDistrict, getTurkeyCities, getDistrictsByCity } from '@tiklayayinla/shared-types';

const featureFields = [
  ['facades', FeatureCategory.FACADE], ['interiorFeatures', FeatureCategory.INTERIOR], ['exteriorFeatures', FeatureCategory.EXTERIOR],
  ['nearbyPlaces', FeatureCategory.NEARBY], ['transportation', FeatureCategory.TRANSPORTATION], ['views', FeatureCategory.VIEW], ['accessibilityFeatures', FeatureCategory.ACCESSIBILITY],
] as const;
type FeatureField = typeof featureFields[number][0];
type FeatureSelections = Partial<Record<FeatureCategory, string[]>>;

const detailInclude = {
  media: { orderBy: { sortOrder: 'asc' } },
  publications: { include: { portal: { select: { id: true, code: true, name: true } } }, orderBy: { updatedAt: 'desc' } },
  residentialDetails: true,
  vehicleDetails: true,
  features: { include: { featureDefinition: true } },
} satisfies Prisma.ListingInclude;
type ListingDetail = Prisma.ListingGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async create(user: AuthenticatedUser, dto: CreateListingDto): Promise<ListingResponseDto> {
    assertPropertySectorAccess(user, 'create');
    const location = normalizeLocation(dto.city, dto.district);
    dto = { ...dto, city: location.city, district: location.district };
    validateHousingType(dto.propertyType, dto.residentialDetails?.housingType);
    const selections = await this.resolveFeatures(dto);
    const listing = await this.prisma.$transaction(async tx => {
      const created = await tx.listing.create({ data: { ...toListingData(dto), ownerId: user.id, listingNo: createListingNo(), status: 'DRAFT' } });
      if (dto.residentialDetails) await tx.residentialDetails.create({ data: { listingId: created.id, ...toResidentialData(dto.residentialDetails) } });
      await this.createFeatureRelations(tx, created.id, selections);
      return tx.listing.findUniqueOrThrow({ where: { id: created.id }, include: detailInclude });
    });
    const response = toResponse(listing);
    await this.audit.log({ actorUserId: user.id, action: AuditAction.LISTING_CREATED, entityType: AuditEntityType.LISTING, entityId: response.id, changes: { fields: ['title', 'description', 'price', 'currency', 'listingType', 'propertyType', 'city', 'district', 'address'] } });
    return response;
  }

  async createVehicle(user: AuthenticatedUser, dto: CreateVehicleListingDto): Promise<ListingResponseDto> {
    assertVehicleSectorAccess(user, 'create');
    const location = normalizeLocation(dto.city, dto.district);
    const vehicle = normalizeVehicleCatalog(dto.brand, dto.model);
    dto = { ...dto, ...vehicle, city: location.city, district: location.district };
    const listing = await this.prisma.$transaction(async tx => {
      const created = await tx.listing.create({
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          price: dto.price,
          currency: dto.currency,
          listingType: dto.listingType,
          propertyType: null,
          listingDomain: ListingDomain.VEHICLE,
          city: dto.city.trim(),
          district: dto.district.trim(),
          neighborhood: dto.neighborhood?.trim() ?? null,
          address: dto.address.trim(),
          ownerId: user.id,
          listingNo: createListingNo(),
          status: 'DRAFT',
        },
      });
      await tx.vehicleDetails.create({
        data: {
          listingId: created.id,
          brand: dto.brand.trim(),
          model: dto.model.trim(),
          year: dto.year,
          mileage: dto.mileage,
          fuelType: dto.fuelType,
          transmission: dto.transmission,
          bodyType: dto.bodyType ?? null,
          enginePower: dto.enginePower ?? null,
          engineVolume: dto.engineVolume ?? null,
          color: dto.color?.trim() ?? null,
          damageStatus: dto.damageStatus?.trim() ?? null,
          hasWarranty: dto.hasWarranty ?? null,
        },
      });
      return tx.listing.findUniqueOrThrow({ where: { id: created.id }, include: detailInclude });
    });
    const response = toResponse(listing);
    await this.audit.log({
      actorUserId: user.id,
      action: AuditAction.LISTING_CREATED,
      entityType: AuditEntityType.LISTING,
      entityId: response.id,
      changes: { fields: ['title', 'description', 'price', 'currency', 'listingType', 'listingDomain', 'city', 'district', 'address', 'brand', 'model', 'year', 'mileage'] },
    });
    return response;
  }

  async updateVehicle(user: AuthenticatedUser, id: string, dto: UpdateVehicleListingDto): Promise<UpdateListingResponseDto> {
    assertVehicleSectorAccess(user, 'update');
    const current = await this.getOwnedDetail(user.id, id);
    if (current.listingDomain !== ListingDomain.VEHICLE) {
      throw new BadRequestException('Bu ilan bir gayrimenkul ilanıdır ve araç güncelleme endpoint’i ile güncellenemez.');
    }
    if (dto.city !== undefined || dto.district !== undefined) {
      const location = normalizeLocation(dto.city ?? current.city, dto.district ?? current.district);
      dto = { ...dto, city: location.city, district: location.district };
    }
    if (dto.brand !== undefined || dto.model !== undefined) {
      const vehicle = normalizeVehicleCatalog(dto.brand ?? current.vehicleDetails?.brand ?? '', dto.model ?? current.vehicleDetails?.model ?? '');
      dto = { ...dto, ...vehicle };
    }
    if (current.status === ListingStatus.PUBLISHING) throw new ConflictException('Yayınlanmakta olan ilan güncellenemez.');
    try {
      const listingData = {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.listingType !== undefined && { listingType: dto.listingType }),
        ...(dto.city !== undefined && { city: dto.city.trim() }),
        ...(dto.district !== undefined && { district: dto.district.trim() }),
        ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood ? dto.neighborhood.trim() : null }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
      };

      const vehicleData = {
        ...(dto.brand !== undefined && { brand: dto.brand.trim() }),
        ...(dto.model !== undefined && { model: dto.model.trim() }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.mileage !== undefined && { mileage: dto.mileage }),
        ...(dto.fuelType !== undefined && { fuelType: dto.fuelType }),
        ...(dto.transmission !== undefined && { transmission: dto.transmission }),
        ...(dto.bodyType !== undefined && { bodyType: dto.bodyType }),
        ...(dto.enginePower !== undefined && { enginePower: dto.enginePower }),
        ...(dto.engineVolume !== undefined && { engineVolume: dto.engineVolume }),
        ...(dto.color !== undefined && { color: dto.color ? dto.color.trim() : null }),
        ...(dto.damageStatus !== undefined && { damageStatus: dto.damageStatus ? dto.damageStatus.trim() : null }),
        ...(dto.hasWarranty !== undefined && { hasWarranty: dto.hasWarranty }),
      };

      const mainChanged = Object.keys(listingData).length > 0 && hasChanged(current, listingData);
      const vehicleChanged = Object.keys(vehicleData).length > 0 && hasChanged(current.vehicleDetails, vehicleData);
      const changed = mainChanged || vehicleChanged;

      const result = await this.prisma.$transaction(async tx => {
        if (mainChanged) await tx.listing.update({ where: { id }, data: listingData });
        if (vehicleChanged) {
          await tx.vehicleDetails.upsert({
            where: { listingId: id },
            create: { listingId: id, brand: '', model: '', year: 0, mileage: 0, fuelType: FuelType.GASOLINE, transmission: TransmissionType.MANUAL, ...vehicleData },
            update: vehicleData,
          });
        }
        const affectedPublications = current.status === ListingStatus.ACTIVE && changed
          ? (await tx.listingPublication.updateMany({ where: { listingId: id, status: PublicationStatus.PUBLISHED }, data: { status: PublicationStatus.UPDATE_REQUIRED, lastError: null } })).count
          : 0;
        return { listing: await tx.listing.findUniqueOrThrow({ where: { id }, include: detailInclude }), affectedPublications };
      });

      const response = {
        ...toResponse(result.listing),
        publicationSync: { required: result.affectedPublications > 0, affectedPublications: result.affectedPublications },
      };

      if (changed) {
        await this.audit.log({
          actorUserId: user.id,
          action: AuditAction.LISTING_UPDATED,
          entityType: AuditEntityType.LISTING,
          entityId: id,
          changes: {
            changedFields: [
              ...(mainChanged ? Object.keys(listingData) : []),
              ...(vehicleChanged ? Object.keys(vehicleData).map((key) => `vehicleDetails.${key}`) : []),
            ],
          },
        });
      }
      return response;
    } catch (error) {
      throw this.toKnownException(error);
    }
  }

  async findAll(ownerId: string, query: ListListingsQueryDto): Promise<ListingsPageResponseDto> {
    const { page, limit, status, listingType, propertyType, city, district, search, sortBy, sortOrder } = query;
    const where: Prisma.ListingWhereInput = { ownerId, status: status ?? { not: ListingStatus.DELETED }, ...(status && { status }), ...(listingType && { listingType }), ...(propertyType && { propertyType }), ...(city && { city: { equals: city, mode: 'insensitive' } }), ...(district && { district: { equals: district, mode: 'insensitive' } }), ...(search && { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }) };
    if (status === ListingStatus.DELETED) where.status = { not: ListingStatus.DELETED };
    const [listings, total] = await this.prisma.$transaction([this.prisma.listing.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sortBy]: sortOrder }, include: detailInclude }), this.prisma.listing.count({ where })]);
    return { data: listings.map(toResponse), pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) } };
  }

  async findOne(ownerId: string, id: string): Promise<ListingResponseDto> { return toResponse(await this.getOwnedDetail(ownerId, id)); }

  async findAllAdmin(): Promise<ListingsPageResponseDto> {
    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({ include: detailInclude, orderBy: { createdAt: 'desc' } }),
      this.prisma.listing.count(),
    ]);
    return { data: listings.map(toResponse), pagination: { page: 1, limit: listings.length || 1, total, totalPages: total ? 1 : 0 } };
  }

  async findOneAdmin(id: string): Promise<ListingResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id }, include: detailInclude });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    return toResponse(listing);
  }

  async updateAdmin(user: AuthenticatedUser, id: string, dto: UpdateListingDto): Promise<UpdateListingResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id }, select: { ownerId: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    return this.update({ ...user, id: listing.ownerId, role: UserRole.USER } as AuthenticatedUser, id, dto);
  }

  async updateVehicleAdmin(user: AuthenticatedUser, id: string, dto: UpdateVehicleListingDto): Promise<UpdateListingResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id }, select: { ownerId: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    return this.updateVehicle({ ...user, id: listing.ownerId, role: UserRole.USER } as AuthenticatedUser, id, dto);
  }

  async updateStatusAdmin(user: AuthenticatedUser, id: string, dto: UpdateListingStatusDto): Promise<ListingResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id }, select: { status: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    const targetStatus = dto.status as ListingStatus;
    const adminStatuses: ListingStatus[] = [ListingStatus.ACTIVE, ListingStatus.SUSPENDED, ListingStatus.DRAFT];
    if (listing.status === ListingStatus.DELETED || !adminStatuses.includes(targetStatus)) throw new ConflictException('Bu ilan için istenen status geçişine izin verilmiyor.');
    const allowed = (listing.status === ListingStatus.ACTIVE && ([ListingStatus.SUSPENDED, ListingStatus.DRAFT] as ListingStatus[]).includes(targetStatus)) || (listing.status === ListingStatus.SUSPENDED && ([ListingStatus.ACTIVE, ListingStatus.DRAFT] as ListingStatus[]).includes(targetStatus)) || (listing.status === ListingStatus.DRAFT && ([ListingStatus.ACTIVE, ListingStatus.SUSPENDED] as ListingStatus[]).includes(targetStatus));
    if (!allowed) throw new ConflictException('Bu ilan için istenen status geçişine izin verilmiyor.');
    const updated = await this.prisma.listing.update({ where: { id }, data: { status: targetStatus }, include: detailInclude });
    await this.audit.log({ actorUserId: user.id, action: AuditAction.LISTING_UPDATED, entityType: AuditEntityType.LISTING, entityId: id, changes: { from: listing.status, to: targetStatus, admin: true } });
    return toResponse(updated);
  }

  async removeAdmin(user: AuthenticatedUser, id: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({ where: { id }, select: { status: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    if (listing.status === ListingStatus.DELETED) return;
    await this.prisma.listing.update({ where: { id }, data: { status: ListingStatus.DELETED, deletedAt: new Date() } });
    await this.audit.log({ actorUserId: user.id, action: AuditAction.LISTING_DELETED, entityType: AuditEntityType.LISTING, entityId: id, changes: { status: listing.status, softDeleted: true, admin: true } });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateListingDto): Promise<UpdateListingResponseDto> {
    assertPropertySectorAccess(user, 'update');
    validateHousingType(dto.propertyType, dto.residentialDetails?.housingType);
    const current = await this.getOwnedDetail(user.id, id);
    if (dto.city !== undefined || dto.district !== undefined) {
      const location = normalizeLocation(dto.city ?? current.city, dto.district ?? current.district);
      dto = { ...dto, city: location.city, district: location.district };
    }
    if (current.status === ListingStatus.PUBLISHING) throw new ConflictException('Yayınlanmakta olan ilan güncellenemez.');
    const selections = await this.resolveFeatures(dto);
    try {
      const listingData = toListingData(dto);
      const residentialData = dto.residentialDetails === undefined ? undefined : toResidentialData(dto.residentialDetails);
      const mainChanged = hasChanged(current, listingData);
      const residentialChanged = residentialData !== undefined && hasChanged(current.residentialDetails, residentialData);
      const changedFeatureCategories = featureFields.filter(([, category]) => selections[category] !== undefined && !sameIds(selections[category]!, current.features.filter((item) => item.featureDefinition.category === category).map((item) => item.featureDefinition.id)));
      const changed = mainChanged || residentialChanged || changedFeatureCategories.length > 0;
      const result = await this.prisma.$transaction(async tx => {
        if (mainChanged) await tx.listing.update({ where: { id }, data: listingData });
        if (residentialChanged && residentialData) await tx.residentialDetails.upsert({ where: { listingId: id }, create: { listingId: id, ...residentialData }, update: residentialData });
        for (const [, category] of changedFeatureCategories) {
          const featureIds = selections[category]!;
          await tx.listingFeature.deleteMany({ where: { listingId: id, featureDefinition: { is: { category } } } });
          if (featureIds.length) await tx.listingFeature.createMany({ data: featureIds.map(featureDefinitionId => ({ listingId: id, featureDefinitionId })), skipDuplicates: true });
        }
        const affectedPublications = current.status === ListingStatus.ACTIVE && changed
          ? (await tx.listingPublication.updateMany({ where: { listingId: id, status: PublicationStatus.PUBLISHED }, data: { status: PublicationStatus.UPDATE_REQUIRED, lastError: null } })).count
          : 0;
        return { listing: await tx.listing.findUniqueOrThrow({ where: { id }, include: detailInclude }), affectedPublications };
      });
      const response = { ...toResponse(result.listing), publicationSync: { required: result.affectedPublications > 0, affectedPublications: result.affectedPublications } };
      if (changed) {
        await this.audit.log({
          actorUserId: user.id,
          action: AuditAction.LISTING_UPDATED,
          entityType: AuditEntityType.LISTING,
          entityId: id,
          changes: { changedFields: [...(mainChanged ? Object.keys(listingData) : []), ...(residentialChanged ? Object.keys(residentialData ?? {}).map((key) => `residentialDetails.${key}`) : []), ...changedFeatureCategories.map(([, category]) => `features.${category}`)] },
        });
      }
      return response;
    } catch (error) { throw this.toKnownException(error); }
  }

  async updateStatus(user: AuthenticatedUser, id: string, dto: UpdateListingStatusDto): Promise<ListingResponseDto> {
    assertPropertySectorAccess(user, 'status');
    const listing = await this.ensureOwned(user.id, id);
    const allowed = (listing.status === ListingStatus.DRAFT && dto.status === ListingStatus.ARCHIVED)
      || (listing.status === ListingStatus.ACTIVE && dto.status === ListingStatus.ARCHIVED)
      || (listing.status === ListingStatus.ARCHIVED && dto.status === ListingStatus.DRAFT);
    if (!allowed) throw new ConflictException('Bu ilan için istenen status geçişine izin verilmiyor.');
    await this.prisma.listing.update({ where: { id }, data: { status: dto.status } });
    const response = await this.findOne(user.id, id);
    await this.audit.log({ actorUserId: user.id, action: dto.status === ListingStatus.ARCHIVED ? AuditAction.LISTING_ARCHIVED : AuditAction.LISTING_RESTORED, entityType: AuditEntityType.LISTING, entityId: id, changes: { from: listing.status, to: dto.status } });
    return response;
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    assertPropertySectorAccess(user, 'remove');
    const listing = await this.prisma.listing.findFirst({ where: { id, ownerId: user.id, status: { not: ListingStatus.DELETED } }, select: { id: true, status: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    if (listing.status === ListingStatus.PUBLISHING || listing.status === ListingStatus.ACTIVE) throw new ConflictException('Yayınlanan veya yayınlanmakta olan ilan silinemez.');
    const activePublication = await this.prisma.listingPublication.findFirst({ where: { listingId: id, status: { in: [PublicationStatus.PENDING, PublicationStatus.QUEUED, PublicationStatus.PROCESSING, PublicationStatus.PUBLISHED] } }, select: { id: true } });
    if (activePublication) throw new ConflictException('Aktif veya yayınlanmış portal kaydı bulunan ilan silinemez.');
    try {
      await this.prisma.listing.update({ where: { id }, data: { status: ListingStatus.DELETED, deletedAt: new Date() } });
      await this.audit.log({ actorUserId: user.id, action: AuditAction.LISTING_DELETED, entityType: AuditEntityType.LISTING, entityId: id, changes: { status: listing.status } });
    } catch (error) { throw this.toKnownException(error); }
  }

  private async resolveFeatures(dto: Partial<CreateListingDto>): Promise<FeatureSelections> {
    const suppliedFields = featureFields.filter(([field]) => dto[field as FeatureField] !== undefined);
    if (!suppliedFields.length) return {};
    const requested = suppliedFields.flatMap(([field, category]) => (dto[field as FeatureField] ?? []).map(code => ({ code, category })));
    const codes = [...new Set(requested.map(item => item.code.trim().toUpperCase()))];
    const definitions = codes.length ? await this.prisma.featureDefinition.findMany({ where: { code: { in: codes }, isActive: true }, select: { id: true, code: true, category: true } }) : [];
    if (definitions.length !== codes.length) throw new UnprocessableEntityException('Geçersiz veya pasif feature code gönderildi.');
    const byCode = new Map(definitions.map(definition => [definition.code, definition]));
    const selections: FeatureSelections = {};
    for (const [field, category] of featureFields) {
      if (dto[field as FeatureField] === undefined) continue;
      const ids = [...new Set(dto[field as FeatureField]!.map(code => code.trim().toUpperCase()))].map(code => {
        const definition = byCode.get(code);
        if (!definition || definition.category !== category) throw new UnprocessableEntityException(`Feature code ${code} bu kategoriye ait değil.`);
        return definition.id;
      });
      selections[category] = ids;
    }
    return selections;
  }

  private async createFeatureRelations(tx: Prisma.TransactionClient, listingId: string, selections: FeatureSelections): Promise<void> {
    const ids = Object.values(selections).flat();
    if (ids.length) await tx.listingFeature.createMany({ data: ids.map(featureDefinitionId => ({ listingId, featureDefinitionId })), skipDuplicates: true });
  }
  private async ensureOwned(ownerId: string, id: string): Promise<Listing> { const listing = await this.prisma.listing.findFirst({ where: { id, ownerId, status: { not: ListingStatus.DELETED } } }); if (!listing) throw new NotFoundException('İlan bulunamadı.'); return listing; }
  private async getOwnedDetail(ownerId: string, id: string): Promise<ListingDetail> { const listing = await this.prisma.listing.findFirst({ where: { id, ownerId, status: { not: ListingStatus.DELETED } }, include: detailInclude }); if (!listing) throw new NotFoundException('İlan bulunamadı.'); return listing; }
  private toKnownException(error: unknown): Error { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') return new NotFoundException('İlan bulunamadı.'); return error as Error; }
}

function createListingNo(): string { return `TL-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`; }
function toListingData(dto: Partial<CreateListingDto>): Prisma.ListingUncheckedCreateInput {
  return { ...(dto.title !== undefined && { title: dto.title.trim() }), ...(dto.description !== undefined && { description: dto.description.trim() }), ...(dto.price !== undefined && { price: dto.price }), ...(dto.currency !== undefined && { currency: dto.currency }), ...(dto.listingType !== undefined && { listingType: dto.listingType }), ...(dto.propertyType !== undefined && { propertyType: dto.propertyType }), ...(dto.city !== undefined && { city: dto.city.trim() }), ...(dto.district !== undefined && { district: dto.district.trim() }), ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood.trim() }), ...(dto.address !== undefined && { address: dto.address.trim() }), ...(dto.latitude !== undefined && { latitude: dto.latitude }), ...(dto.longitude !== undefined && { longitude: dto.longitude }) } as Prisma.ListingUncheckedCreateInput;
}
function toResidentialData(dto: ResidentialDetailsDto): Omit<Prisma.ResidentialDetailsUncheckedCreateInput, 'listingId'> { return { ...(dto.grossArea !== undefined && { grossArea: dto.grossArea }), ...(dto.netArea !== undefined && { netArea: dto.netArea }), ...(dto.roomCount !== undefined && { roomCount: dto.roomCount.trim() }), ...(dto.buildingAge !== undefined && { buildingAge: dto.buildingAge }), ...(dto.floorNumber !== undefined && { floorNumber: dto.floorNumber }), ...(dto.totalFloors !== undefined && { totalFloors: dto.totalFloors }), ...(dto.heatingType !== undefined && { heatingType: dto.heatingType }), ...(dto.bathroomCount !== undefined && { bathroomCount: dto.bathroomCount }), ...(dto.kitchenType !== undefined && { kitchenType: dto.kitchenType }), ...(dto.hasBalcony !== undefined && { hasBalcony: dto.hasBalcony }), ...(dto.hasElevator !== undefined && { hasElevator: dto.hasElevator }), ...(dto.parkingType !== undefined && { parkingType: dto.parkingType }), ...(dto.isFurnished !== undefined && { isFurnished: dto.isFurnished }), ...(dto.occupancyStatus !== undefined && { occupancyStatus: dto.occupancyStatus }), ...(dto.isInComplex !== undefined && { isInComplex: dto.isInComplex }), ...(dto.complexName !== undefined && { complexName: dto.complexName.trim() }), ...(dto.monthlyFee !== undefined && { monthlyFee: dto.monthlyFee }), ...(dto.isCreditEligible !== undefined && { isCreditEligible: dto.isCreditEligible }), ...(dto.energyCertificate !== undefined && { energyCertificate: dto.energyCertificate }), ...(dto.titleDeedStatus !== undefined && { titleDeedStatus: dto.titleDeedStatus }), ...(dto.advertiserType !== undefined && { advertiserType: dto.advertiserType }), ...(dto.isExchangeAccepted !== undefined && { isExchangeAccepted: dto.isExchangeAccepted }), ...(dto.housingType !== undefined && { housingType: dto.housingType }) }; }
function hasChanged(current: Record<string, unknown> | null, update: Record<string, unknown>): boolean { return Object.entries(update).some(([key, value]) => String(current?.[key] ?? '') !== String(value ?? '')); }
function sameIds(left: string[], right: string[]): boolean { return left.length === right.length && left.every((id) => right.includes(id)); }

function validateHousingType(propertyType?: PropertyType, housingType?: HousingType): void {
  if (!propertyType || !housingType) return;
  if (!isHousingTypeCompatible(propertyType, housingType)) throw new UnprocessableEntityException('Seçilen konut tipi, gayrimenkul tipiyle uyuşmuyor.');
}

function normalizeLocation(city: string, district: string): { city: string; district: string } {
  const cityValue = city.trim();
  const canonicalCity = getTurkeyCities().find((item) => item.name.toLocaleLowerCase('tr-TR') === cityValue.toLocaleLowerCase('tr-TR'))?.name
    ?? getTurkeyCities().find((item) => `${item.name} merkez`.toLocaleLowerCase('tr-TR') === cityValue.toLocaleLowerCase('tr-TR'))?.name;
  if (!canonicalCity || !isValidTurkeyCity(canonicalCity)) throw new BadRequestException('Geçerli bir Türkiye ili seçilmelidir.');
  const districtValue = district.trim();
  const districts = getDistrictsByCity(canonicalCity);
  const canonicalDistrict = districts.find((item) => item.toLocaleLowerCase('tr-TR') === districtValue.toLocaleLowerCase('tr-TR'))
    ?? (districtValue.toLocaleLowerCase('tr-TR') === canonicalCity.toLocaleLowerCase('tr-TR') ? districts.find((item) => item === 'Merkez') : undefined);
  if (!canonicalDistrict || !isValidTurkeyCityDistrict(canonicalCity, canonicalDistrict)) throw new BadRequestException('İlçe seçilen ile ait değil.');
  return { city: canonicalCity, district: canonicalDistrict };
}

function normalizeVehicleCatalog(brand: string, model: string): { brand: string; model: string } {
  if (!isValidVehicleBrandModel(brand, model)) throw new BadRequestException('Geçerli bir marka ve o markaya ait model seçilmelidir.');
  return { brand: getCanonicalVehicleBrand(brand)!, model: getCanonicalVehicleModel(brand, model)! };
}

function toResponse(listing: ListingDetail): ListingResponseDto {
  const groups = { facades: [], interiorFeatures: [], exteriorFeatures: [], nearbyPlaces: [], transportation: [], views: [], accessibilityFeatures: [] } as ListingResponseDto['features'];
  const categoryKeys: Record<FeatureCategory, keyof typeof groups> = { FACADE: 'facades', INTERIOR: 'interiorFeatures', EXTERIOR: 'exteriorFeatures', NEARBY: 'nearbyPlaces', TRANSPORTATION: 'transportation', VIEW: 'views', ACCESSIBILITY: 'accessibilityFeatures' };
  for (const { featureDefinition } of listing.features) groups[categoryKeys[featureDefinition.category]].push({ code: featureDefinition.code, label: featureDefinition.label });
  return {
    ...listing,
    price: Number(listing.price),
    latitude: listing.latitude === null ? null : Number(listing.latitude),
    longitude: listing.longitude === null ? null : Number(listing.longitude),
    residentialDetails: listing.residentialDetails ? decimalObject(listing.residentialDetails) as ListingResponseDto['residentialDetails'] : null,
    vehicleDetails: listing.vehicleDetails ? (listing.vehicleDetails as any) : null,
    media: listing.media,
    publications: listing.publications,
    features: groups,
  };
}
function decimalObject<T extends Record<string, unknown>>(value: T): T { return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item instanceof Prisma.Decimal ? Number(item) : item])) as T; }
