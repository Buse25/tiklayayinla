import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FeatureCategory, Listing, Prisma, PublicationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings-query.dto';
import { ListingResponseDto, ListingsPageResponseDto } from './dto/listing-response.dto';
import { ResidentialDetailsDto } from './dto/residential-details.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

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
  features: { include: { featureDefinition: true } },
} satisfies Prisma.ListingInclude;
type ListingDetail = Prisma.ListingGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateListingDto): Promise<ListingResponseDto> {
    const selections = await this.resolveFeatures(dto);
    const listing = await this.prisma.$transaction(async tx => {
      const created = await tx.listing.create({ data: { ...toListingData(dto), ownerId, listingNo: createListingNo(), status: 'DRAFT' } });
      if (dto.residentialDetails) await tx.residentialDetails.create({ data: { listingId: created.id, ...toResidentialData(dto.residentialDetails) } });
      await this.createFeatureRelations(tx, created.id, selections);
      return tx.listing.findUniqueOrThrow({ where: { id: created.id }, include: detailInclude });
    });
    return toResponse(listing);
  }

  async findAll(ownerId: string, query: ListListingsQueryDto): Promise<ListingsPageResponseDto> {
    const { page, limit, status, listingType, propertyType, city, district, search, sortBy, sortOrder } = query;
    const where: Prisma.ListingWhereInput = { ownerId, ...(status && { status }), ...(listingType && { listingType }), ...(propertyType && { propertyType }), ...(city && { city: { equals: city, mode: 'insensitive' } }), ...(district && { district: { equals: district, mode: 'insensitive' } }), ...(search && { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }) };
    const [listings, total] = await this.prisma.$transaction([this.prisma.listing.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sortBy]: sortOrder }, include: detailInclude }), this.prisma.listing.count({ where })]);
    return { data: listings.map(toResponse), pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) } };
  }

  async findOne(ownerId: string, id: string): Promise<ListingResponseDto> { return toResponse(await this.getOwnedDetail(ownerId, id)); }

  async update(ownerId: string, id: string, dto: UpdateListingDto): Promise<ListingResponseDto> {
    await this.ensureOwned(ownerId, id);
    const selections = await this.resolveFeatures(dto);
    try {
      const listing = await this.prisma.$transaction(async tx => {
        await tx.listing.update({ where: { id }, data: toListingData(dto) });
        if (dto.residentialDetails !== undefined) await tx.residentialDetails.upsert({ where: { listingId: id }, create: { listingId: id, ...toResidentialData(dto.residentialDetails) }, update: toResidentialData(dto.residentialDetails) });
        for (const [category, featureIds] of Object.entries(selections) as [FeatureCategory, string[]][]) {
          await tx.listingFeature.deleteMany({ where: { listingId: id, featureDefinition: { is: { category } } } });
          if (featureIds.length) await tx.listingFeature.createMany({ data: featureIds.map(featureDefinitionId => ({ listingId: id, featureDefinitionId })), skipDuplicates: true });
        }
        return tx.listing.findUniqueOrThrow({ where: { id }, include: detailInclude });
      });
      return toResponse(listing);
    } catch (error) { throw this.toKnownException(error); }
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const listing = await this.prisma.listing.findFirst({ where: { id, ownerId }, select: { id: true } });
    if (!listing) throw new NotFoundException('İlan bulunamadı.');
    const activePublication = await this.prisma.listingPublication.findFirst({ where: { listingId: id, status: { in: [PublicationStatus.PENDING, PublicationStatus.QUEUED, PublicationStatus.PROCESSING, PublicationStatus.PUBLISHED] } }, select: { id: true } });
    if (activePublication) throw new ConflictException('Aktif veya yayınlanmış portal kaydı bulunan ilan silinemez.');
    try { await this.prisma.listing.delete({ where: { id } }); } catch (error) { throw this.toKnownException(error); }
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
  private async ensureOwned(ownerId: string, id: string): Promise<Listing> { const listing = await this.prisma.listing.findFirst({ where: { id, ownerId } }); if (!listing) throw new NotFoundException('İlan bulunamadı.'); return listing; }
  private async getOwnedDetail(ownerId: string, id: string): Promise<ListingDetail> { const listing = await this.prisma.listing.findFirst({ where: { id, ownerId }, include: detailInclude }); if (!listing) throw new NotFoundException('İlan bulunamadı.'); return listing; }
  private toKnownException(error: unknown): Error { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') return new NotFoundException('İlan bulunamadı.'); return error as Error; }
}

function createListingNo(): string { return `TL-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`; }
function toListingData(dto: Partial<CreateListingDto>): Prisma.ListingUncheckedCreateInput {
  return { ...(dto.title !== undefined && { title: dto.title.trim() }), ...(dto.description !== undefined && { description: dto.description.trim() }), ...(dto.price !== undefined && { price: dto.price }), ...(dto.currency !== undefined && { currency: dto.currency }), ...(dto.listingType !== undefined && { listingType: dto.listingType }), ...(dto.propertyType !== undefined && { propertyType: dto.propertyType }), ...(dto.city !== undefined && { city: dto.city.trim() }), ...(dto.district !== undefined && { district: dto.district.trim() }), ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood.trim() }), ...(dto.address !== undefined && { address: dto.address.trim() }), ...(dto.latitude !== undefined && { latitude: dto.latitude }), ...(dto.longitude !== undefined && { longitude: dto.longitude }) } as Prisma.ListingUncheckedCreateInput;
}
function toResidentialData(dto: ResidentialDetailsDto): Omit<Prisma.ResidentialDetailsUncheckedCreateInput, 'listingId'> { return { ...(dto.grossArea !== undefined && { grossArea: dto.grossArea }), ...(dto.netArea !== undefined && { netArea: dto.netArea }), ...(dto.roomCount !== undefined && { roomCount: dto.roomCount.trim() }), ...(dto.buildingAge !== undefined && { buildingAge: dto.buildingAge }), ...(dto.floorNumber !== undefined && { floorNumber: dto.floorNumber }), ...(dto.totalFloors !== undefined && { totalFloors: dto.totalFloors }), ...(dto.heatingType !== undefined && { heatingType: dto.heatingType }), ...(dto.bathroomCount !== undefined && { bathroomCount: dto.bathroomCount }), ...(dto.kitchenType !== undefined && { kitchenType: dto.kitchenType }), ...(dto.hasBalcony !== undefined && { hasBalcony: dto.hasBalcony }), ...(dto.hasElevator !== undefined && { hasElevator: dto.hasElevator }), ...(dto.parkingType !== undefined && { parkingType: dto.parkingType }), ...(dto.isFurnished !== undefined && { isFurnished: dto.isFurnished }), ...(dto.occupancyStatus !== undefined && { occupancyStatus: dto.occupancyStatus }), ...(dto.isInComplex !== undefined && { isInComplex: dto.isInComplex }), ...(dto.complexName !== undefined && { complexName: dto.complexName.trim() }), ...(dto.monthlyFee !== undefined && { monthlyFee: dto.monthlyFee }), ...(dto.isCreditEligible !== undefined && { isCreditEligible: dto.isCreditEligible }), ...(dto.energyCertificate !== undefined && { energyCertificate: dto.energyCertificate }), ...(dto.titleDeedStatus !== undefined && { titleDeedStatus: dto.titleDeedStatus }), ...(dto.advertiserType !== undefined && { advertiserType: dto.advertiserType }), ...(dto.isExchangeAccepted !== undefined && { isExchangeAccepted: dto.isExchangeAccepted }), ...(dto.housingType !== undefined && { housingType: dto.housingType }) }; }

function toResponse(listing: ListingDetail): ListingResponseDto {
  const groups = { facades: [], interiorFeatures: [], exteriorFeatures: [], nearbyPlaces: [], transportation: [], views: [], accessibilityFeatures: [] } as ListingResponseDto['features'];
  const categoryKeys: Record<FeatureCategory, keyof typeof groups> = { FACADE: 'facades', INTERIOR: 'interiorFeatures', EXTERIOR: 'exteriorFeatures', NEARBY: 'nearbyPlaces', TRANSPORTATION: 'transportation', VIEW: 'views', ACCESSIBILITY: 'accessibilityFeatures' };
  for (const { featureDefinition } of listing.features) groups[categoryKeys[featureDefinition.category]].push({ code: featureDefinition.code, label: featureDefinition.label });
  return { ...listing, price: Number(listing.price), latitude: listing.latitude === null ? null : Number(listing.latitude), longitude: listing.longitude === null ? null : Number(listing.longitude), residentialDetails: listing.residentialDetails ? decimalObject(listing.residentialDetails) as ListingResponseDto['residentialDetails'] : null, media: listing.media, publications: listing.publications, features: groups };
}
function decimalObject<T extends Record<string, unknown>>(value: T): T { return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item instanceof Prisma.Decimal ? Number(item) : item])) as T; }
