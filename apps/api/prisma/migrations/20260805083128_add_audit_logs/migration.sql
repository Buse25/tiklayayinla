-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LISTING_CREATED', 'LISTING_UPDATED', 'LISTING_DELETED', 'LISTING_ARCHIVED', 'LISTING_RESTORED', 'LISTING_PUBLISHED', 'LISTING_REPUBLISHED', 'PORTAL_ACCOUNT_CREATED', 'PORTAL_ACCOUNT_UPDATED', 'PORTAL_ACCOUNT_DELETED', 'PORTAL_ACCOUNT_CONNECTION_TESTED', 'USER_PROFILE_UPDATED', 'IMPORT_CONFIRMED');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('LISTING', 'PORTAL_ACCOUNT', 'USER', 'IMPORT_BATCH');

-- AlterTable
ALTER TABLE "ListingMedia" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "changes" JSONB,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
