CREATE TYPE "EidsListingAuthorizationStatus" AS ENUM ('NOT_VERIFIED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'REVOKED');

ALTER TYPE "AuditAction" ADD VALUE 'LISTING_EIDS_AUTHORIZATION_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_EIDS_AUTHORIZATION_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_EIDS_AUTHORIZATION_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_EIDS_AUTHORIZATION_EXPIRED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_EIDS_AUTHORIZATION_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_PUBLISH_BLOCKED_BY_EIDS';

CREATE TABLE "EidsListingAuthorization" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "domain" "ListingDomain" NOT NULL,
    "status" "EidsListingAuthorizationStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
    "verificationMethod" "EidsVerificationMethod",
    "externalReference" TEXT,
    "snapshot" JSONB,
    "validUntil" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EidsListingAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EidsListingAuthorization_listingId_key" ON "EidsListingAuthorization"("listingId");
CREATE INDEX "EidsListingAuthorization_userId_status_idx" ON "EidsListingAuthorization"("userId", "status");
CREATE INDEX "EidsListingAuthorization_domain_status_idx" ON "EidsListingAuthorization"("domain", "status");
CREATE INDEX "EidsListingAuthorization_nextCheckAt_idx" ON "EidsListingAuthorization"("nextCheckAt");

ALTER TABLE "EidsListingAuthorization" ADD CONSTRAINT "EidsListingAuthorization_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EidsListingAuthorization" ADD CONSTRAINT "EidsListingAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
