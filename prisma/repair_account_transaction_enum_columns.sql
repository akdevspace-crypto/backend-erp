DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AccountTransaction'
      AND column_name = 'type'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE public."AccountTransaction"
      ALTER COLUMN "type" TYPE public."TransactionType"
      USING "type"::public."TransactionType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AccountTransaction'
      AND column_name = 'status'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE public."AccountTransaction"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE public."TransactionStatus"
      USING "status"::public."TransactionStatus",
      ALTER COLUMN "status" SET DEFAULT 'CREATED'::public."TransactionStatus";
  END IF;
END $$;
