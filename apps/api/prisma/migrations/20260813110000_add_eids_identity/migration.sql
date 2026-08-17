-- CreateEnum
CREATE TYPE "EidsIdentityStatus" AS ENUM ('NOT_VERIFIED', 'PENDING', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "EidsIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "EidsIdentityStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
    "userCode" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EidsIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EidsIdentity_userId_key" ON "EidsIdentity"("userId");

-- AddForeignKey
ALTER TABLE "EidsIdentity" ADD CONSTRAINT "EidsIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
