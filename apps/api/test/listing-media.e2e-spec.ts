import '../src/environment';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Currency, ListingStatus, ListingType, PropertyType, UserRole, UserStatus } from '@prisma/client';
import { rm } from 'fs/promises';
import { resolve } from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Listing media (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let otherUserId: string;
  let listingId: string;
  let otherListingId: string;
  let accessToken: string;
  let otherAccessToken: string;
  let image: Buffer;
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, errorHttpStatusCode: 422 }));
    await app.init();
    prisma = app.get(PrismaService);
    const [owner, other] = await Promise.all([
      prisma.user.create({ data: { email: `media-owner-${suffix}@example.test`, passwordHash: 'test', firstName: 'Media', lastName: 'Owner', role: UserRole.USER, status: UserStatus.ACTIVE } }),
      prisma.user.create({ data: { email: `media-other-${suffix}@example.test`, passwordHash: 'test', firstName: 'Media', lastName: 'Other', role: UserRole.USER, status: UserStatus.ACTIVE } }),
    ]);
    ownerId = owner.id; otherUserId = other.id;
    const [listing, otherListing] = await Promise.all([createListing(ownerId), createListing(otherUserId)]);
    listingId = listing.id; otherListingId = otherListing.id;
    const jwt = app.get(JwtService); const secret = process.env.JWT_ACCESS_SECRET!;
    [accessToken, otherAccessToken] = await Promise.all([jwt.signAsync({ sub: ownerId, email: owner.email, role: owner.role, type: 'access' }, { secret, expiresIn: '15m' }), jwt.signAsync({ sub: otherUserId, email: other.email, role: other.role, type: 'access' }, { secret, expiresIn: '15m' })]);
    image = await sharp({ create: { width: 80, height: 60, channels: 3, background: { r: 200, g: 100, b: 50 } } }).jpeg().toBuffer();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId] } } });
    await Promise.allSettled([rm(resolve(process.cwd(), 'uploads', 'listings', listingId), { recursive: true, force: true }), rm(resolve(process.cwd(), 'uploads', 'listings', otherListingId), { recursive: true, force: true })]);
    await app.close();
  });

  it('returns 401 for unauthenticated upload', async () => {
    await request(app.getHttpServer()).post(`/api/v1/listings/${listingId}/media`).attach('files', image, { filename: 'home.jpg', contentType: 'image/jpeg' }).expect(401);
  });

  it('returns 404 for another user listing upload', async () => {
    await request(app.getHttpServer()).post(`/api/v1/listings/${otherListingId}/media`).set('Authorization', `Bearer ${accessToken}`).attach('files', image, { filename: 'home.jpg', contentType: 'image/jpeg' }).expect(404);
  });

  it('returns 422 for invalid mime type and oversized file', async () => {
    await request(app.getHttpServer()).post(`/api/v1/listings/${listingId}/media`).set('Authorization', `Bearer ${accessToken}`).attach('files', Buffer.from('not an image'), { filename: 'document.txt', contentType: 'text/plain' }).expect(422);
    await request(app.getHttpServer()).post(`/api/v1/listings/${listingId}/media`).set('Authorization', `Bearer ${accessToken}`).attach('files', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'large.jpg', contentType: 'image/jpeg' }).expect(422);
  });

  it('makes the first upload cover and stores optimized images', async () => {
    const response = await request(app.getHttpServer()).post(`/api/v1/listings/${listingId}/media`).set('Authorization', `Bearer ${accessToken}`).attach('files', image, { filename: 'first.jpg', contentType: 'image/jpeg' }).attach('files', image, { filename: 'second.jpg', contentType: 'image/jpeg' }).expect(201);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].isCover).toBe(true);
    expect(response.body[0].mimeType).toBe('image/webp');
    expect(response.body[0].width).toBe(80);
    expect(response.body[0].storageKey).toContain(`listings/${listingId}/`);
  });

  it('reorders media and switches cover', async () => {
    const media = await request(app.getHttpServer()).get(`/api/v1/listings/${listingId}/media`).set('Authorization', `Bearer ${accessToken}`).expect(200);
    const [first, second] = media.body;
    const reordered = await request(app.getHttpServer()).patch(`/api/v1/listings/${listingId}/media/reorder`).set('Authorization', `Bearer ${accessToken}`).send({ mediaIds: [second.id, first.id] }).expect(200);
    expect(reordered.body.map((item: { id: string }) => item.id)).toEqual([second.id, first.id]);
    const cover = await request(app.getHttpServer()).patch(`/api/v1/listings/${listingId}/media/${second.id}/cover`).set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(cover.body.isCover).toBe(true);
  });

  it('deletes an image and assigns a new cover when cover is removed', async () => {
    const media = await request(app.getHttpServer()).get(`/api/v1/listings/${listingId}/media`).set('Authorization', `Bearer ${accessToken}`).expect(200);
    const currentCover = media.body.find((item: { isCover: boolean }) => item.isCover);
    await request(app.getHttpServer()).delete(`/api/v1/listings/${listingId}/media/${currentCover.id}`).set('Authorization', `Bearer ${accessToken}`).expect(204);
    const remaining = await request(app.getHttpServer()).get(`/api/v1/listings/${listingId}/media`).set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(remaining.body).toHaveLength(1);
    expect(remaining.body[0].isCover).toBe(true);
    expect(remaining.body[0].id).not.toBe(currentCover.id);
  });

  function createListing(ownerId: string) {
    return prisma.listing.create({ data: { ownerId, title: 'Medya test ilanı', description: 'Medya yükleme testleri için yeterince uzun açıklama.', price: 1000000, currency: Currency.TRY, listingType: ListingType.SALE, propertyType: PropertyType.APARTMENT, city: 'İstanbul', district: 'Kadıköy', address: 'Test adresi', status: ListingStatus.DRAFT } });
  }
});
