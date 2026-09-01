ALTER TABLE "AccountTransaction"
ADD COLUMN IF NOT EXISTS "metadata" JSONB;
