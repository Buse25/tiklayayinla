import '../src/environment';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Currency, ListingStatus, ListingType, PropertyType, PublicationStatus, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Listings CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let otherUserId: string;
  let accessToken: string;
  let otherAccessToken: string;
  const testSuffix = Date.now().toString();
  const listingBody = { title: 'Kadıköy merkezde bakımlı 2+1 daire', description: 'Toplu ulaşıma yakın, aydınlık ve bakımlı satılık daire.', price: 4750000, currency: Currency.TRY, listingType: ListingType.SALE, propertyType: PropertyType.APARTMENT, city: 'İstanbul', district: 'Kadıköy', neighborhood: 'Caferağa', address: 'Caferağa Mahallesi Moda Caddesi No: 1', residentialDetails: { roomCount: '2+1', grossArea: 110, netArea: 90, heatingType: 'COMBI_BOILER', hasBalcony: true }, facades: ['SOUTH'], interiorFeatures: ['SMART_HOME', 'SMART_HOME'] };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, errorHttpStatusCode: 422 }));
    await app.init();
    prisma = app.get(PrismaService);
    const [owner, other] = await Promise.all([
      prisma.user.create({ data: { email: `listings-owner-${testSuffix}@example.test`, passwordHash: 'test', firstName: 'Owner', lastName: 'Test', role: UserRole.USER, status: UserStatus.ACTIVE, emailVerified: true } }),
      prisma.user.create({ data: { email: `listings-other-${testSuffix}@example.test`, passwordHash: 'test', firstName: 'Other', lastName: 'Test', role: UserRole.USER, status: UserStatus.ACTIVE, emailVerified: true } }),
    ]);
    ownerId = owner.id; otherUserId = other.id;
    const jwt = app.get(JwtService);
    const secret = process.env.JWT_ACCESS_SECRET!;
    [accessToken, otherAccessToken] = await Promise.all([jwt.signAsync({ sub: ownerId, email: owner.email, role: owner.role, type: 'access', sessionVersion: 0 }, { secret, expiresIn: '15m' }), jwt.signAsync({ sub: otherUserId, email: other.email, role: other.role, type: 'access', sessionVersion: 0 }, { secret, expiresIn: '15m' })]);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId] } } });
    await prisma.portal.deleteMany({ where: { code: 'test-publication-portal' } });
    await app.close();
  });

  it('returns 401 for an unauthenticated create request', async () => {
    await request(app.getHttpServer()).post('/api/v1/listings').send(listingBody).expect(401);
  });

  it('returns 422 for an invalid feature code', async () => {
    await request(app.getHttpServer()).post('/api/v1/listings').set('Authorization', `Bearer ${accessToken}`).send({ ...listingBody, interiorFeatures: ['UNKNOWN_FEATURE'] }).expect(422);
  });

  it('creates a DRAFT listing for the authenticated user', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/listings').set('Authorization', `Bearer ${accessToken}`).send(listingBody).expect(201);
    expect(response.body.ownerId).toBe(ownerId);
    expect(response.body.status).toBe(ListingStatus.DRAFT);
    expect(response.body.price).toBe(4750000);
    expect(response.body.listingNo).toMatch(/^TL-/);
    expect(response.body.residentialDetails.roomCount).toBe('2+1');
    expect(response.body.features.interiorFeatures).toHaveLength(1);
  });

  it('lists only listings owned by the authenticated user', async () => {
    await createDatabaseListing(otherUserId, ListingStatus.DRAFT);
    const response = await request(app.getHttpServer()).get('/api/v1/listings?limit=100').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].ownerId).toBe(ownerId);
  });

  it('returns 404 when another user requests listing detail', async () => {
    const listing = await prisma.listing.findFirstOrThrow({ where: { ownerId } });
    await request(app.getHttpServer()).get(`/api/v1/listings/${listing.id}`).set('Authorization', `Bearer ${otherAccessToken}`).expect(404);
  });

  it('updates an owned listing', async () => {
    const listing = await prisma.listing.findFirstOrThrow({ where: { ownerId } });
    const response = await request(app.getHttpServer()).patch(`/api/v1/listings/${listing.id}`).set('Authorization', `Bearer ${accessToken}`).send({ title: 'Kadıköy merkezde güncellenmiş 2+1 daire', price: 4850000, residentialDetails: { buildingAge: 6 }, interiorFeatures: [] }).expect(200);
    expect(response.body.title).toContain('güncellenmiş');
    expect(response.body.price).toBe(4850000);
    expect(response.body.residentialDetails.buildingAge).toBe(6);
    expect(response.body.features.interiorFeatures).toHaveLength(0);
    expect(response.body.features.facades).toHaveLength(1);
  });

  it('returns 409 when deleting a listing with a published publication', async () => {
    const portal = await prisma.portal.upsert({ where: { code: 'test-publication-portal' }, update: {}, create: { code: 'test-publication-portal', name: 'Test publication portal', adapterKey: 'test-publication-portal' } });
    const listing = await createDatabaseListing(ownerId, ListingStatus.ACTIVE, 'Yayınlanmış test ilanı');
    await prisma.listingPublication.create({ data: { listingId: listing.id, portalId: portal.id, status: PublicationStatus.PUBLISHED } });
    await request(app.getHttpServer()).delete(`/api/v1/listings/${listing.id}`).set('Authorization', `Bearer ${accessToken}`).expect(409);
  });

  it('soft deletes a draft listing with 204', async () => {
    const listing = await createDatabaseListing(ownerId, ListingStatus.DRAFT, 'Silinecek taslak test ilanı');
    await request(app.getHttpServer()).delete(`/api/v1/listings/${listing.id}`).set('Authorization', `Bearer ${accessToken}`).expect(204);
    const deleted = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(deleted).not.toBeNull();
    expect(deleted?.status).toBe(ListingStatus.DELETED);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it('returns the CSV import template with correct headers and type', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/listings/import/template')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('tiklayayinla-listing-import-template.csv');
    expect(response.text).toContain('\uFEFFtitle;description;price;currency;');
  });

  function createDatabaseListing(ownerId: string, status: ListingStatus, title = listingBody.title) {
    return prisma.listing.create({ data: { title, description: listingBody.description, price: listingBody.price, currency: listingBody.currency, listingType: listingBody.listingType, propertyType: listingBody.propertyType, city: listingBody.city, district: listingBody.district, neighborhood: listingBody.neighborhood, address: listingBody.address, ownerId, status, residentialDetails: { create: listingBody.residentialDetails } } });
  }
});
