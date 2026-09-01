CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public."RefCounter"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public."AccountTransaction"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Invoice'
  ) THEN
    IF EXISTS (SELECT 1 FROM public."Invoice" LIMIT 1) THEN
      RAISE NOTICE 'Invoice table has rows; preserving existing table shape.';
    ELSE
      DROP TABLE public."Invoice";

      CREATE TABLE public."Invoice" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "amount" double precision NOT NULL,
        "status" text NOT NULL,
        "tenantId" text NOT NULL,
        "unitId" text NOT NULL,
        "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "Invoice_tenantId_idx" ON public."Invoice"("tenantId");
      CREATE INDEX IF NOT EXISTS "Invoice_unitId_idx" ON public."Invoice"("unitId");
    END IF;
  ELSE
    CREATE TABLE public."Invoice" (
      "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "amount" double precision NOT NULL,
      "status" text NOT NULL,
      "tenantId" text NOT NULL,
      "unitId" text NOT NULL,
      "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "Invoice_tenantId_idx" ON public."Invoice"("tenantId");
    CREATE INDEX IF NOT EXISTS "Invoice_unitId_idx" ON public."Invoice"("unitId");
  END IF;
END $$;
