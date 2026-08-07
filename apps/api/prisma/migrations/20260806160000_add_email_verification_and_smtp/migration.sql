ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION_CODE_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION_RESENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MAIL_DELIVERY_FAILED';

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

UPDATE "User"
SET "emailVerified" = true,
    "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW());

CREATE TABLE IF NOT EXISTS "EmailVerificationCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmailVerificationCode"
ADD CONSTRAINT "EmailVerificationCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "EmailVerificationCode_userId_idx" ON "EmailVerificationCode"("userId");
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_email_idx" ON "EmailVerificationCode"("email");
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_consumedAt_idx" ON "EmailVerificationCode"("consumedAt");
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_invalidatedAt_idx" ON "EmailVerificationCode"("invalidatedAt");

