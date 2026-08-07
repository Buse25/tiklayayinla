import { AuditAction, AuditEntityType, MembershipStatus, OrganizationApplicationStatus, OrganizationRole, OrganizationStatus, OrganizationType, UserRole } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const reviewerId = '22222222-2222-2222-2222-222222222222';
  const applicationId = '33333333-3333-3333-3333-333333333333';

  let prisma: PrismaService;
  let audit: AuditService;
  let service: OrganizationsService;
  let tx: {
    organizationApplication: { update: jest.Mock };
    organization: { create: jest.Mock };
    organizationMembership: { create: jest.Mock };
  };

  beforeEach(() => {
    tx = {
      organizationApplication: { update: jest.fn() },
      organization: { create: jest.fn() },
      organizationMembership: { create: jest.fn() },
    };
    prisma = {
      organizationApplication: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      organizationMembership: {
        findFirst: jest.fn(),
      },
      organization: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    audit = { log: jest.fn() } as unknown as AuditService;
    service = new OrganizationsService(prisma, audit);
  });

  it('creates a pending real estate application without storing license number', async () => {
  mockEligibilityForCreate();

  (
    prisma.organizationApplication.create as jest.Mock
  ).mockResolvedValue(
    applicationRecord({
      id: applicationId,
      status: OrganizationApplicationStatus.PENDING,
    }),
  );

  const created = await service.createApplication(
    { id: userId, role: UserRole.USER },
    {
      organizationName: 'Yılmaz Gayrimenkul',
      organizationType: OrganizationType.REAL_ESTATE_AGENCY,
      country: 'Türkiye',
      city: 'Bursa',
      district: 'Osmangazi',
      taxOffice: 'Bursa Vergi Dairesi',
      vkn: '1234567890',
      authorizedPersonName: 'Ahmet Yılmaz',
      companyPhone: '+902242221122',
      businessEmail: 'kurumsal@firma.com',
      address: 'Çekirge Mah. Atatürk Cad. No: 10',
      licenseNumber: 'IGNORED-LICENSE',
    },
  );

  expect(created.status).toBe(
    OrganizationApplicationStatus.PENDING,
  );

  expect(
    prisma.organizationApplication.create,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        userId,
        organizationName: 'Yılmaz Gayrimenkul',
        organizationType:
          OrganizationType.REAL_ESTATE_AGENCY,
        country: 'Türkiye',
        city: 'Bursa',
        district: 'Osmangazi',
        taxOffice: 'Bursa Vergi Dairesi',
        vkn: '1234567890',
        authorizedPersonName: 'Ahmet Yılmaz',
        companyPhone: '+902242221122',
        businessEmail: 'kurumsal@firma.com',
        address: 'Çekirge Mah. Atatürk Cad. No: 10',
        licenseNumber: undefined,
      }),
    }),
  );

  expect(audit.log).toHaveBeenCalledWith(
    expect.objectContaining({
      actorUserId: userId,
      action: AuditAction.ORGANIZATION_APPLICATION_CREATED,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: applicationId,
    }),
  );
});

  it('rejects a new application while a pending application exists', async () => {
    mockEligibilityForCreate({ activeApplications: [{ status: OrganizationApplicationStatus.PENDING }] });

    await expect(service.createApplication({ id: userId, role: UserRole.USER }, baseApplicationDto())).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_APPLICATION_ALREADY_PENDING' },
    });
  });

  it('rejects a new application while an approved application exists', async () => {
    mockEligibilityForCreate({ activeApplications: [{ status: OrganizationApplicationStatus.APPROVED }] });

    await expect(service.createApplication({ id: userId, role: UserRole.USER }, baseApplicationDto())).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_APPLICATION_ALREADY_APPROVED' },
    });
  });

  it('rejects OTHER sector applications', async () => {
    mockEligibilityForCreate();

    await expect(service.createApplication({ id: userId, role: UserRole.USER }, {
      ...baseApplicationDto(),
      organizationType: OrganizationType.OTHER,
    })).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_TYPE_NOT_SUPPORTED' },
    });
  });

  it('allows a new application after rejection', async () => {
    mockEligibilityForCreate();
    (prisma.organizationApplication.create as jest.Mock).mockResolvedValue(applicationRecord({ id: applicationId, status: OrganizationApplicationStatus.PENDING }));

    const result = await service.createApplication({ id: userId, role: UserRole.USER }, baseApplicationDto());

    expect(result.status).toBe(OrganizationApplicationStatus.PENDING);
    expect(prisma.organizationApplication.create).toHaveBeenCalled();
  });

  it('rejects a new application when an active OWNER membership already exists', async () => {
    mockEligibilityForCreate({ activeOwnerMembership: true });

    await expect(service.createApplication({ id: userId, role: UserRole.USER }, baseApplicationDto())).rejects.toMatchObject({
      response: { code: 'USER_ALREADY_HAS_ACTIVE_ORGANIZATION' },
    });
  });

  it('requires a license number for AUTO_DEALER applications', async () => {
    mockEligibilityForCreate();

    await expect(service.createApplication({ id: userId, role: UserRole.USER }, {
      ...baseApplicationDto(),
      organizationType: OrganizationType.AUTO_DEALER,
      licenseNumber: null,
    })).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_LICENSE_NUMBER_REQUIRED' },
    });
  });

  it('does not store a license number for REAL_ESTATE_AGENCY applications', async () => {
    mockEligibilityForCreate();
    (prisma.organizationApplication.create as jest.Mock).mockResolvedValue(applicationRecord({ id: applicationId, status: OrganizationApplicationStatus.PENDING, licenseNumber: null }));

    await service.createApplication({ id: userId, role: UserRole.USER }, {
      ...baseApplicationDto(),
      organizationType: OrganizationType.REAL_ESTATE_AGENCY,
      licenseNumber: 'EIDS-IGNORED-001',
    });

    expect(prisma.organizationApplication.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        licenseNumber: undefined,
      }),
    }));
  });

  it('approves an application by mapping all organization fields', async () => {
    (prisma.organizationApplication.findUnique as jest.Mock).mockResolvedValue(applicationRecord({
      id: applicationId,
      userId,
      status: OrganizationApplicationStatus.PENDING,
      organizationName: 'Yılmaz Gayrimenkul',
      organizationType: OrganizationType.REAL_ESTATE_AGENCY,
      country: 'Türkiye',
      city: 'Bursa',
      district: 'Osmangazi',
      taxOffice: 'Bursa Vergi Dairesi',
      vkn: '1234567890',
      authorizedPersonName: 'Ahmet Yılmaz',
      companyPhone: '+902242221122',
      businessEmail: 'kurumsal@firma.com',
      address: 'Çekirge Mah. Atatürk Cad. No: 10',
      licenseNumber: 'EIDS-YETKI-2026-001',
    }));
    tx.organizationApplication.update.mockResolvedValue(applicationRecord({
      id: applicationId,
      userId,
      status: OrganizationApplicationStatus.APPROVED,
      reviewedById: reviewerId,
      reviewedAt: new Date('2026-08-06T08:00:00.000Z'),
      organizationName: 'Yılmaz Gayrimenkul',
      organizationType: OrganizationType.REAL_ESTATE_AGENCY,
      country: 'Türkiye',
      city: 'Bursa',
      district: 'Osmangazi',
      taxOffice: 'Bursa Vergi Dairesi',
      vkn: '1234567890',
      authorizedPersonName: 'Ahmet Yılmaz',
      companyPhone: '+902242221122',
      businessEmail: 'kurumsal@firma.com',
      address: 'Çekirge Mah. Atatürk Cad. No: 10',
      licenseNumber: 'EIDS-YETKI-2026-001',
    }));
    tx.organization.create.mockResolvedValue({ id: '44444444-4444-4444-4444-444444444444' });
    tx.organizationMembership.create.mockResolvedValue({ id: '55555555-5555-5555-5555-555555555555' });

    const result = await service.approveApplication(reviewerId, UserRole.ADMIN, applicationId);

    expect(result.status).toBe(OrganizationApplicationStatus.APPROVED);
    expect(tx.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Yılmaz Gayrimenkul',
        type: OrganizationType.REAL_ESTATE_AGENCY,
        country: 'Türkiye',
        city: 'Bursa',
        district: 'Osmangazi',
        address: 'Çekirge Mah. Atatürk Cad. No: 10',
        phone: '+902242221122',
        taxNumber: '1234567890',
        taxOffice: 'Bursa Vergi Dairesi',
        businessEmail: 'kurumsal@firma.com',
        authorizedPersonName: 'Ahmet Yılmaz',
        licenseNumber: 'EIDS-YETKI-2026-001',
        status: OrganizationStatus.ACTIVE,
      }),
    }));
    expect(tx.organizationMembership.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: '44444444-4444-4444-4444-444444444444',
        userId,
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
      }),
    }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: reviewerId,
      action: AuditAction.ORGANIZATION_APPLICATION_APPROVED,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: applicationId,
    }));
  });

  function mockEligibilityForCreate(options?: { activeApplications?: Array<{ status: OrganizationApplicationStatus }>; activeOwnerMembership?: boolean }) {
    (prisma.organizationMembership.findFirst as jest.Mock).mockResolvedValue(options?.activeOwnerMembership ? { id: 'membership-id' } : null);
    (prisma.organizationApplication.findMany as jest.Mock).mockResolvedValue(options?.activeApplications ?? []);
    (prisma.organizationApplication.findFirst as jest.Mock).mockResolvedValue(null);
  }

  function baseApplicationDto() {
    return {
      organizationName: 'Yılmaz Gayrimenkul',
      organizationType: OrganizationType.REAL_ESTATE_AGENCY,
      country: 'Türkiye',
      city: 'Bursa',
      district: 'Osmangazi',
      authorizedPersonName: 'Ahmet Yılmaz',
      address: 'Çekirge Mah. Atatürk Cad. No: 10',
    };
  }

  function applicationRecord(overrides: Partial<{
    id: string;
    userId: string;
    organizationName: string;
    organizationType: OrganizationType;
    country: string;
    city: string;
    district: string;
    taxOffice: string | null;
    vkn: string | null;
    authorizedPersonName: string;
    companyPhone: string | null;
    businessEmail: string | null;
    address: string;
    licenseNumber: string | null;
    status: OrganizationApplicationStatus;
    rejectionReason: string | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}) {
    return {
      id: overrides.id ?? applicationId,
      userId: overrides.userId ?? userId,
      organizationName: overrides.organizationName ?? 'Yılmaz Gayrimenkul',
      organizationType: overrides.organizationType ?? OrganizationType.REAL_ESTATE_AGENCY,
      country: overrides.country ?? 'Türkiye',
      city: overrides.city ?? 'Bursa',
      district: overrides.district ?? 'Osmangazi',
      taxOffice: overrides.taxOffice ?? 'Bursa Vergi Dairesi',
      vkn: overrides.vkn ?? '1234567890',
      authorizedPersonName: overrides.authorizedPersonName ?? 'Ahmet Yılmaz',
      companyPhone: overrides.companyPhone ?? '+902242221122',
      businessEmail: overrides.businessEmail ?? 'kurumsal@firma.com',
      address: overrides.address ?? 'Çekirge Mah. Atatürk Cad. No: 10',
      licenseNumber: overrides.licenseNumber ?? 'EIDS-YETKI-2026-001',
      status: overrides.status ?? OrganizationApplicationStatus.PENDING,
      rejectionReason: overrides.rejectionReason ?? null,
      reviewedById: overrides.reviewedById ?? null,
      reviewedAt: overrides.reviewedAt ?? null,
      createdAt: overrides.createdAt ?? new Date('2026-08-06T00:00:00.000Z'),
      updatedAt: overrides.updatedAt ?? new Date('2026-08-06T00:00:00.000Z'),
      user: { id: userId, email: 'user@example.test', firstName: 'Ali', lastName: 'Veli' },
      reviewedBy: null,
    };
  }
});
