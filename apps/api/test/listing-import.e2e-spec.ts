import '../src/environment';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuditAction, AuditEntityType, UserRole, UserStatus } from '@prisma/client';
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
      prisma.user.create({ data: { email: `import-owner-${suffix}@example.test`, passwordHash: 'test', firstName: 'Owner', lastName: 'Import', role: UserRole.USER, status: UserStatus.ACTIVE } }),
      prisma.user.create({ data: { email: `import-other-${suffix}@example.test`, passwordHash: 'test', firstName: 'Other', lastName: 'Import', role: UserRole.USER, status: UserStatus.ACTIVE } }),
    ]);
    ownerId = owner.id;
    otherUserId = other.id;
    const jwt = app.get(JwtService);
    const secret = process.env.JWT_ACCESS_SECRET!;
    accessToken = await jwt.signAsync({ sub: ownerId, email: owner.email, role: owner.role, type: 'access' }, { secret, expiresIn: '15m' });
    otherAccessToken = await jwt.signAsync({ sub: otherUserId, email: other.email, role: other.role, type: 'access' }, { secret, expiresIn: '15m' });
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
