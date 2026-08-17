-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PHONE_OTP_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PHONE_OTP_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'PHONE_OTP_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PHONE_OTP_MAX_ATTEMPTS';

-- CreateTable
CREATE TABLE "PhoneVerificationCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneVerificationCode_userId_phone_consumedAt_invalidatedAt_idx" ON "PhoneVerificationCode"("userId", "phone", "consumedAt", "invalidatedAt");
CREATE INDEX "PhoneVerificationCode_resendAvailableAt_idx" ON "PhoneVerificationCode"("resendAvailableAt");
CREATE INDEX "PhoneVerificationCode_expiresAt_idx" ON "PhoneVerificationCode"("expiresAt");

ALTER TABLE "PhoneVerificationCode" ADD CONSTRAINT "PhoneVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
