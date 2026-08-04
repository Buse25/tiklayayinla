ALTER TABLE "Portal"
  ADD COLUMN "connectionType" TEXT NOT NULL DEFAULT 'REST_API',
  ADD COLUMN "credentialSchema" JSONB,
  ADD COLUMN "documentationUrl" TEXT,
  ADD COLUMN "logoUrl" TEXT;
