ALTER TYPE "OrganizationApplicationStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DELETED';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'DELETED';

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "OrganizationApplication" ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "OrganizationApplication" SET "approvedAt" = "reviewedAt" WHERE "status" = 'APPROVED' AND "approvedAt" IS NULL;

CREATE INDEX "Listing_status_deletedAt_idx" ON "Listing"("status", "deletedAt");
CREATE INDEX "User_status_deletedAt_idx" ON "User"("status", "deletedAt");
