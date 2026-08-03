-- CreateEnum
CREATE TYPE "FeatureCategory" AS ENUM ('FACADE', 'INTERIOR', 'EXTERIOR', 'NEARBY', 'TRANSPORTATION', 'VIEW', 'ACCESSIBILITY');
CREATE TYPE "HeatingType" AS ENUM ('NONE', 'CENTRAL', 'COMBI_BOILER', 'UNDERFLOOR', 'STOVE', 'AIR_CONDITIONING', 'GEOTHERMAL', 'SOLAR', 'OTHER');
CREATE TYPE "KitchenType" AS ENUM ('OPEN', 'CLOSED', 'AMERICAN', 'OTHER');
CREATE TYPE "ParkingType" AS ENUM ('NONE', 'OPEN', 'COVERED', 'GARAGE', 'VALET', 'OTHER');
CREATE TYPE "OccupancyStatus" AS ENUM ('VACANT', 'OWNER_OCCUPIED', 'TENANT_OCCUPIED', 'UNDER_CONSTRUCTION');
CREATE TYPE "EnergyCertificate" AS ENUM ('A_PLUS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'UNKNOWN');
CREATE TYPE "TitleDeedStatus" AS ENUM ('OWNERSHIP', 'CONDOMINIUM_EASEMENT', 'CONSTRUCTION_SERVITUDE', 'LAND_TITLE', 'OTHER');
CREATE TYPE "AdvertiserType" AS ENUM ('OWNER', 'AGENT', 'AGENCY', 'DEVELOPER');
CREATE TYPE "HousingType" AS ENUM ('APARTMENT', 'VILLA', 'DETACHED_HOUSE', 'RESIDENCE', 'SUMMER_HOUSE', 'LOFT', 'DUPLEX', 'PENTHOUSE', 'STUDIO', 'OTHER');

-- New Listing metadata is added in a data-safe order for existing rows.
ALTER TABLE "Listing" ADD COLUMN "listingNo" TEXT, ADD COLUMN "neighborhood" TEXT;
UPDATE "Listing" SET "listingNo" = 'TL-' || upper(substring(replace("id"::text, '-', '') from 1 for 12)) WHERE "listingNo" IS NULL;
ALTER TABLE "Listing" ALTER COLUMN "listingNo" SET NOT NULL;
CREATE UNIQUE INDEX "Listing_listingNo_key" ON "Listing"("listingNo");

CREATE TABLE "ResidentialDetails" (
    "listingId" UUID NOT NULL,
    "grossArea" DECIMAL(10,2),
    "netArea" DECIMAL(10,2),
    "roomCount" TEXT,
    "buildingAge" INTEGER,
    "floorNumber" INTEGER,
    "totalFloors" INTEGER,
    "heatingType" "HeatingType",
    "bathroomCount" INTEGER,
    "kitchenType" "KitchenType",
    "hasBalcony" BOOLEAN,
    "hasElevator" BOOLEAN,
    "parkingType" "ParkingType",
    "isFurnished" BOOLEAN,
    "occupancyStatus" "OccupancyStatus",
    "isInComplex" BOOLEAN,
    "complexName" TEXT,
    "monthlyFee" DECIMAL(12,2),
    "isCreditEligible" BOOLEAN,
    "energyCertificate" "EnergyCertificate",
    "titleDeedStatus" "TitleDeedStatus",
    "advertiserType" "AdvertiserType",
    "isExchangeAccepted" BOOLEAN,
    "housingType" "HousingType",
    CONSTRAINT "ResidentialDetails_pkey" PRIMARY KEY ("listingId")
);

-- Preserve pre-existing Listing residential data before removing duplicated columns.
INSERT INTO "ResidentialDetails" ("listingId", "grossArea", "netArea", "roomCount")
SELECT "id", "grossArea", "netArea", "roomCount" FROM "Listing"
WHERE "grossArea" IS NOT NULL OR "netArea" IS NOT NULL OR "roomCount" IS NOT NULL;
ALTER TABLE "Listing" DROP COLUMN "grossArea", DROP COLUMN "netArea", DROP COLUMN "roomCount";

CREATE TABLE "FeatureDefinition" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "FeatureCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeatureDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ListingFeature" (
    "listingId" UUID NOT NULL,
    "featureDefinitionId" UUID NOT NULL,
    CONSTRAINT "ListingFeature_pkey" PRIMARY KEY ("listingId", "featureDefinitionId")
);
CREATE UNIQUE INDEX "FeatureDefinition_code_key" ON "FeatureDefinition"("code");
CREATE INDEX "FeatureDefinition_category_isActive_idx" ON "FeatureDefinition"("category", "isActive");
CREATE INDEX "ListingFeature_featureDefinitionId_idx" ON "ListingFeature"("featureDefinitionId");
ALTER TABLE "ResidentialDetails" ADD CONSTRAINT "ResidentialDetails_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingFeature" ADD CONSTRAINT "ListingFeature_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingFeature" ADD CONSTRAINT "ListingFeature_featureDefinitionId_fkey" FOREIGN KEY ("featureDefinitionId") REFERENCES "FeatureDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
