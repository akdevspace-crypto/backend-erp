CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."RefCounter" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prefix" text NOT NULL,
  "current" integer NOT NULL DEFAULT 0,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL
);

ALTER TABLE public."RefCounter"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX IF NOT EXISTS "RefCounter_prefix_tenantId_key"
  ON public."RefCounter"("prefix", "tenantId");

CREATE INDEX IF NOT EXISTS "RefCounter_tenantId_idx"
  ON public."RefCounter"("tenantId");

CREATE INDEX IF NOT EXISTS "RefCounter_unitId_idx"
  ON public."RefCounter"("unitId");
