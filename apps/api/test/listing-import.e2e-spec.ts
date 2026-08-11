import '../src/environment';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuditAction, AuditEntityType, UserRole, UserStatus, OrganizationType, MembershipStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Listing import (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let otherUserId: string;
  let accessToken: string;
  let otherAccessToken: string;
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, errorHttpStatusCode: 422 }));
    await app.init();
    prisma = app.get(PrismaService);
    const [owner, other] = await Promise.all([
      prisma.user.create({ data: { email: `import-owner-${suffix}@example.test`, passwordHash: 'test', firstName: 'Owner', lastName: 'Import', role: UserRole.USER, status: UserStatus.ACTIVE, emailVerified: true } }),
      prisma.user.create({ data: { email: `import-other-${suffix}@example.test`, passwordHash: 'test', firstName: 'Other', lastName: 'Import', role: UserRole.USER, status: UserStatus.ACTIVE, emailVerified: true } }),
    ]);
    ownerId = owner.id;
    otherUserId = other.id;
    const jwt = app.get(JwtService);
    const secret = process.env.JWT_ACCESS_SECRET!;
    accessToken = await jwt.signAsync({ sub: ownerId, email: owner.email, role: owner.role, type: 'access', sessionVersion: 0 }, { secret, expiresIn: '15m' });
    otherAccessToken = await jwt.signAsync({ sub: otherUserId, email: other.email, role: other.role, type: 'access', sessionVersion: 0 }, { secret, expiresIn: '15m' });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: [ownerId, otherUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId] } } });
    await app.close();
  });

  it('analyzes JSON, transforms it, confirms valid rows and writes audit log', async () => {
    const records = [
      validRecord('JSON import satılık daire'),
      { ...validRecord('Eksik açıklamalı ilan'), description: 'kısa' },
    ];

    const analysis = await request(app.getHttpServer())
      .post('/api/v1/listings/import/analyze')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from(JSON.stringify(records)), { filename: 'import.json', contentType: 'application/json' })
      .expect(201);

    expect(analysis.body.analysisToken).toBeTruthy();
    expect(analysis.body.sourceType).toBe('JSON');

    const mapping = analysis.body.fields.map((field: { sourceField: string }) => ({ sourceField: field.sourceField, targetField: field.sourceField, transformation: null }));
    const preview = await request(app.getHttpServer())
      .post('/api/v1/listings/import/transform')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ analysisToken: analysis.body.analysisToken, mapping })
      .expect(200);

    expect(preview.body.previewToken).toBeTruthy();
    expect(preview.body.summary.totalRows).toBe(2);
    expect(preview.body.summary.validRows).toBe(1);
    expect(preview.body.summary.invalidRows).toBe(1);
    expect(preview.body.errors[0].row).toBe(2);

    const confirm = await request(app.getHttpServer())
      .post('/api/v1/listings/import/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ previewToken: preview.body.previewToken })
      .expect(200);

    expect(confirm.body.summary.createdRows).toBe(1);
    expect(confirm.body.summary.skippedRows).toBe(1);
    expect(confirm.body.createdListings).toHaveLength(1);

    const listing = await prisma.listing.findUnique({ where: { id: confirm.body.createdListings[0].id } });
    expect(listing?.ownerId).toBe(ownerId);

    const audit = await prisma.auditLog.findFirst({ where: { actorUserId: ownerId, action: AuditAction.IMPORT_CONFIRMED, entityType: AuditEntityType.IMPORT_BATCH } });
    expect(audit).toBeTruthy();
  });

  it('rejects invalid or cross-user preview tokens', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/listings/import/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ previewToken: 'not-a-token' })
      .expect(400);

    const analysis = await request(app.getHttpServer())
      .post('/api/v1/listings/import/analyze')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from(JSON.stringify([validRecord('Token izolasyon ilanı')])), { filename: 'token.json', contentType: 'application/json' })
      .expect(201);
    const mapping = analysis.body.fields.map((field: { sourceField: string }) => ({ sourceField: field.sourceField, targetField: field.sourceField, transformation: null }));
    const preview = await request(app.getHttpServer())
      .post('/api/v1/listings/import/transform')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ analysisToken: analysis.body.analysisToken, mapping })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/listings/import/confirm')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .send({ previewToken: preview.body.previewToken })
      .expect(401);
  });

  it('allows AUTO_DEALER to download template, preview, analyze, transform, but rejects confirm', async () => {
    const dealerSuffix = Date.now().toString() + '-dealer';
    const dealer = await prisma.user.create({
      data: {
        email: `dealer-${dealerSuffix}@example.test`,
        passwordHash: 'test',
        firstName: 'Dealer',
        lastName: 'Test',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    const org = await prisma.organization.create({
      data: {
        name: `Dealer Org ${dealerSuffix}`,
        type: OrganizationType.AUTO_DEALER,
        country: 'Turkey',
        city: 'Istanbul',
        district: 'Kadikoy',
        address: 'Dealer address',
      },
    });

    await prisma.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: dealer.id,
        role: 'OWNER',
        status: MembershipStatus.ACTIVE,
      },
    });

    const secret = process.env.JWT_ACCESS_SECRET!;
    const dealerToken = await app.get(JwtService).signAsync(
      { sub: dealer.id, email: dealer.email, role: dealer.role, type: 'access', sessionVersion: 0 },
      { secret, expiresIn: '15m' },
    );

    await request(app.getHttpServer())
      .get('/api/v1/listings/import/template')
      .set('Authorization', `Bearer ${dealerToken}`)
      .expect(200);

    const csvContent = '\uFEFFtitle;description;price;currency;listing_type;property_type;city;district;address\n' +
      'Dealer test;Backend import testi için yeterince uzun açıklama alanı;1250000;TRY;SALE;APARTMENT;İstanbul;Kadıköy;Caferağa Mahallesi';
    const file = Buffer.from(csvContent, 'utf8');
    
    await request(app.getHttpServer())
      .post('/api/v1/listings/import/preview')
      .set('Authorization', `Bearer ${dealerToken}`)
      .attach('file', file, { filename: 'dealer-import.csv', contentType: 'text/csv' })
      .expect(201);

    const analysisRes = await request(app.getHttpServer())
      .post('/api/v1/listings/import/analyze')
      .set('Authorization', `Bearer ${dealerToken}`)
      .attach('file', file, { filename: 'dealer-import.csv', contentType: 'text/csv' })
      .expect(201);

    const mapping = analysisRes.body.fields.map((field: { sourceField: string }) => ({ sourceField: field.sourceField, targetField: field.sourceField, transformation: null }));
    const transformRes = await request(app.getHttpServer())
      .post('/api/v1/listings/import/transform')
      .set('Authorization', `Bearer ${dealerToken}`)
      .send({ analysisToken: analysisRes.body.analysisToken, mapping })
      .expect(200);

    const confirmRes = await request(app.getHttpServer())
      .post('/api/v1/listings/import/confirm')
      .set('Authorization', `Bearer ${dealerToken}`)
      .send({ previewToken: transformRes.body.previewToken })
      .expect(422);

    expect(confirmRes.body.code).toBe('AUTO_DEALER_VEHICLE_DOMAIN_PENDING');
    expect(confirmRes.body.message).toBe('Bu hesap türü ile gayrimenkul ilanı içe aktaramazsınız.');

    await prisma.organizationMembership.deleteMany({ where: { userId: dealer.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: dealer.id } });
  });
});

function validRecord(title: string) {
  return {
    title,
    description: 'Backend import testi için yeterince uzun açıklama alanı',
    price: '1250000',
    currency: 'TRY',
    listing_type: 'SALE',
    property_type: 'APARTMENT',
    city: 'İstanbul',
    district: 'Kadıköy',
    address: `${title} adres`,
    gross_area: '120',
    net_area: '95',
    has_balcony: 'true',
  };
}
