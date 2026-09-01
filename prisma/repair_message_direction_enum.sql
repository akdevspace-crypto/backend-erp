DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageDirection') THEN
    CREATE TYPE public."MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');
  END IF;

  IF to_regclass('public."Message"') IS NOT NULL THEN
    UPDATE public."Message"
    SET "direction" = CASE
      WHEN UPPER("direction"::text) IN ('INBOUND', 'OUTBOUND', 'SYSTEM') THEN UPPER("direction"::text)
      ELSE 'OUTBOUND'
    END;

    ALTER TABLE public."Message"
      ALTER COLUMN "direction" TYPE public."MessageDirection"
      USING UPPER("direction"::text)::public."MessageDirection";
  END IF;
END $$;
