-- CreateEnum
CREATE TYPE "ListingDomain" AS ENUM ('PROPERTY', 'VEHICLE');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'OTHER');

-- CreateEnum
CREATE TYPE "TransmissionType" AS ENUM ('MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC');

-- CreateEnum
CREATE TYPE "VehicleBodyType" AS ENUM ('SEDAN', 'HATCHBACK', 'SUV', 'COUPE', 'STATION_WAGON', 'PICKUP', 'VAN', 'MINIVAN', 'OTHER');

-- DropIndex
DROP INDEX "Listing_status_deletedAt_idx";

-- DropIndex
DROP INDEX "User_status_deletedAt_idx";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "listingDomain" "ListingDomain" NOT NULL DEFAULT 'PROPERTY',
ALTER COLUMN "propertyType" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VehicleDetails" (
    "listingId" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "transmission" "TransmissionType" NOT NULL,
    "bodyType" "VehicleBodyType",
    "enginePower" INTEGER,
    "engineVolume" INTEGER,
    "color" TEXT,
    "damageStatus" TEXT,
    "hasWarranty" BOOLEAN,

    CONSTRAINT "VehicleDetails_pkey" PRIMARY KEY ("listingId")
);

-- AddForeignKey
ALTER TABLE "VehicleDetails" ADD CONSTRAINT "VehicleDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
