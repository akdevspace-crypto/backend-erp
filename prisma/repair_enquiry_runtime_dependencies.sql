-- Runtime dependencies used by the enquiry list/detail APIs.
-- These are intentionally additive and preserve existing data.

CREATE TABLE IF NOT EXISTS public."FollowUp" (
  "id" text PRIMARY KEY,
  "enquiryId" text NOT NULL REFERENCES public."Enquiry"("id") ON UPDATE CASCADE,
  "notes" text,
  "scheduledAt" timestamp without time zone,
  "actualAt" timestamp without time zone,
  "channel" text DEFAULT 'CALL',
  "response" boolean NOT NULL DEFAULT false,
  "converted" boolean NOT NULL DEFAULT false,
  "responseAt" timestamp without time zone,
  "outcome" text DEFAULT 'PENDING',
  "variant" text,
  "successScore" double precision NOT NULL DEFAULT 0,
  "clientInterest" text,
  "readyToPayAmount" double precision,
  "paymentMode" text,
  "nextFollowupStatus" text,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "FollowUp_tenantId_idx" ON public."FollowUp"("tenantId");
CREATE INDEX IF NOT EXISTS "FollowUp_unitId_idx" ON public."FollowUp"("unitId");
CREATE INDEX IF NOT EXISTS "FollowUp_scheduledAt_idx" ON public."FollowUp"("scheduledAt");

CREATE TABLE IF NOT EXISTS public."AutomationScore" (
  "id" text PRIMARY KEY,
  "entityId" text NOT NULL,
  "module" text NOT NULL,
  "score" double precision NOT NULL,
  "label" text NOT NULL,
  "probability" double precision NOT NULL DEFAULT 0,
  "confidence" double precision NOT NULL DEFAULT 0,
  "historyScore" double precision NOT NULL DEFAULT 0,
  "factors" jsonb,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "complaintId" text,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Score_Enquiry_FK" FOREIGN KEY ("entityId") REFERENCES public."Enquiry"("id") ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationScore_entityId_module_key"
  ON public."AutomationScore"("entityId", "module");
CREATE INDEX IF NOT EXISTS "AutomationScore_tenantId_idx" ON public."AutomationScore"("tenantId");
CREATE INDEX IF NOT EXISTS "AutomationScore_unitId_idx" ON public."AutomationScore"("unitId");
CREATE INDEX IF NOT EXISTS "AutomationScore_entityId_idx" ON public."AutomationScore"("entityId");
CREATE INDEX IF NOT EXISTS "AutomationScore_complaintId_idx" ON public."AutomationScore"("complaintId");
