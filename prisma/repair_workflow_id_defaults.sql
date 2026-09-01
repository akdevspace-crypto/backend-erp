CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public."Staff" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."Client" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."ClientService" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."Patient" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."Enquiry" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."Admission" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."FollowUp" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."Allocation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."Task" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."Approval" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."MedicalAssignment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public."AutomationScore" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
