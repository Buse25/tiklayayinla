-- CreateTable
CREATE TABLE "EidsVerificationSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "correlationTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EidsVerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EidsVerificationSession_correlationTokenHash_key" ON "EidsVerificationSession"("correlationTokenHash");
CREATE INDEX "EidsVerificationSession_userId_consumedAt_idx" ON "EidsVerificationSession"("userId", "consumedAt");
CREATE INDEX "EidsVerificationSession_expiresAt_idx" ON "EidsVerificationSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "EidsVerificationSession" ADD CONSTRAINT "EidsVerificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
