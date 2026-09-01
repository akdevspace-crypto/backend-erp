-- The live User.id column is uuid, while most ERP ids are text.
-- Make user reference columns uuid before adding User foreign keys.

DO $$
BEGIN
  IF to_regclass('public."Staff"') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Staff'
        AND column_name = 'userId'
        AND udt_name <> 'uuid'
    )
  THEN
    ALTER TABLE public."Staff"
      ALTER COLUMN "userId" TYPE uuid USING NULLIF("userId"::text, '')::uuid;
  END IF;
END $$;
