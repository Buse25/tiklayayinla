ALTER TABLE "User"
ADD COLUMN "about" TEXT,
ADD COLUMN "address" TEXT;

CREATE TABLE "PasswordChangeCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
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
    CONSTRAINT "PasswordChangeCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordChangeCode_userId_idx" ON "PasswordChangeCode"("userId");
CREATE INDEX "PasswordChangeCode_expiresAt_idx" ON "PasswordChangeCode"("expiresAt");
CREATE INDEX "PasswordChangeCode_consumedAt_idx" ON "PasswordChangeCode"("consumedAt");
CREATE INDEX "PasswordChangeCode_invalidatedAt_idx" ON "PasswordChangeCode"("invalidatedAt");
ALTER TABLE "PasswordChangeCode" ADD CONSTRAINT "PasswordChangeCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
