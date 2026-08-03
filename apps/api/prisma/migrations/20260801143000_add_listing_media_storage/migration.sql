ALTER TABLE "ListingMedia"
  ADD COLUMN "storageKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "originalName" TEXT,
  ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
  ADD COLUMN "fileSize" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "isCover" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- PostgreSQL partial unique index guarantees one cover at most per listing.
CREATE UNIQUE INDEX "ListingMedia_one_cover_per_listing" ON "ListingMedia"("listingId") WHERE "isCover" = true;
