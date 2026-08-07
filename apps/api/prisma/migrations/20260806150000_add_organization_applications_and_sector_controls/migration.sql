-- Add organization application workflow and supporting organization metadata.
CREATE TYPE "OrganizationApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Organization"
  ADD COLUMN "taxOffice" TEXT,
  ADD COLUMN "businessEmail" TEXT,
  ADD COLUMN "authorizedPersonName" TEXT,
  ADD COLUMN "licenseNumber" TEXT;

CREATE TABLE "OrganizationApplication" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "organizationName" TEXT NOT NULL,
  "organizationType" "OrganizationType" NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "taxOffice" TEXT,
  "vkn" TEXT,
  "authorizedPersonName" TEXT NOT NULL,
  "companyPhone" TEXT,
  "businessEmail" TEXT,
  "address" TEXT NOT NULL,
  "licenseNumber" TEXT,
  "status" "OrganizationApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationApplication_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrganizationApplication"
  ADD CONSTRAINT "OrganizationApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationApplication"
  ADD CONSTRAINT "OrganizationApplication_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "OrganizationApplication_userId_status_idx" ON "OrganizationApplication"("userId", "status");
CREATE INDEX "OrganizationApplication_organizationType_status_idx" ON "OrganizationApplication"("organizationType", "status");
CREATE INDEX "OrganizationApplication_reviewedById_createdAt_idx" ON "OrganizationApplication"("reviewedById", "createdAt");

ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_APPLICATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_APPLICATION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_APPLICATION_REJECTED';
