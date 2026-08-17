-- CreateEnum
CREATE TYPE "EidsVerificationMethod" AS ENUM ('EIDS', 'ADMIN_TEST');

-- AlterTable
ALTER TABLE "EidsIdentity" ADD COLUMN "verificationMethod" "EidsVerificationMethod";
