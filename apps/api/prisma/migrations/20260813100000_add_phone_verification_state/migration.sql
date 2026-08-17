-- CreateEnum
CREATE TYPE "PhoneVerificationMethod" AS ENUM ('ADMIN', 'OTP');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN "phoneVerificationMethod" "PhoneVerificationMethod";
