-- Preserve older omnichannel rows before syncing the current Prisma schema.
-- This maps legacy Conversation/Message columns into the required current columns.

DO $$
DECLARE
  default_tenant_id uuid;
  default_unit_id uuid;
BEGIN
  SELECT id INTO default_tenant_id FROM public."Tenant" ORDER BY "createdAt" ASC LIMIT 1;
  SELECT id INTO default_unit_id FROM public."Unit" ORDER BY "createdAt" ASC LIMIT 1;

  IF default_tenant_id IS NULL OR default_unit_id IS NULL THEN
    RAISE EXCEPTION 'Cannot repair Conversation/Message schema: Tenant or Unit table is empty.';
  END IF;

  IF to_regclass('public."Conversation"') IS NOT NULL THEN
    ALTER TABLE public."Conversation"
      ADD COLUMN IF NOT EXISTS "entityType" text,
      ADD COLUMN IF NOT EXISTS "entityId" text,
      ADD COLUMN IF NOT EXISTS "tenantId" uuid,
      ADD COLUMN IF NOT EXISTS "unitId" uuid,
      ADD COLUMN IF NOT EXISTS "lastInboundChannel" text,
      ADD COLUMN IF NOT EXISTS "subject" text,
      ADD COLUMN IF NOT EXISTS "externalThreadId" text,
      ADD COLUMN IF NOT EXISTS "lastMessageAt" timestamp without time zone,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb;

    UPDATE public."Conversation"
    SET
      "entityType" = COALESCE("entityType", 'legacy_conversation'),
      "entityId" = COALESCE("entityId", id::text),
      "tenantId" = COALESCE("tenantId", default_tenant_id),
      "unitId" = COALESCE("unitId", default_unit_id),
      "lastMessageAt" = COALESCE("lastMessageAt", "updatedAt", "createdAt");

    ALTER TABLE public."Conversation"
      ALTER COLUMN "entityType" SET NOT NULL,
      ALTER COLUMN "entityId" SET NOT NULL,
      ALTER COLUMN "tenantId" SET NOT NULL,
      ALTER COLUMN "unitId" SET NOT NULL;

    -- Current Prisma expects channel as text, while the legacy table used ChannelType enum.
    ALTER TABLE public."Conversation"
      ALTER COLUMN "channel" TYPE text USING "channel"::text;
  END IF;

  IF to_regclass('public."Message"') IS NOT NULL THEN
    ALTER TABLE public."Message"
      ADD COLUMN IF NOT EXISTS "direction" text,
      ADD COLUMN IF NOT EXISTS "channel" text,
      ADD COLUMN IF NOT EXISTS "sender" text,
      ADD COLUMN IF NOT EXISTS "recipient" text,
      ADD COLUMN IF NOT EXISTS "body" text,
      ADD COLUMN IF NOT EXISTS "templateName" text,
      ADD COLUMN IF NOT EXISTS "variant" text,
      ADD COLUMN IF NOT EXISTS "externalUserId" text,
      ADD COLUMN IF NOT EXISTS "externalMessageId" text,
      ADD COLUMN IF NOT EXISTS "deliveryStatus" text,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb,
      ADD COLUMN IF NOT EXISTS "sentAt" timestamp without time zone,
      ADD COLUMN IF NOT EXISTS "deliveredAt" timestamp without time zone,
      ADD COLUMN IF NOT EXISTS "readAt" timestamp without time zone,
      ADD COLUMN IF NOT EXISTS "tenantId" uuid,
      ADD COLUMN IF NOT EXISTS "unitId" uuid;

    UPDATE public."Message" m
    SET
      "body" = COALESCE(m."body", m."content", ''),
      "direction" = COALESCE(
        m."direction",
        CASE
          WHEN UPPER(COALESCE(m."senderType", '')) IN ('CUSTOMER', 'CLIENT', 'USER') THEN 'INBOUND'
          WHEN UPPER(COALESCE(m."senderType", '')) IN ('SYSTEM', 'BOT', 'AI') THEN 'SYSTEM'
          ELSE 'OUTBOUND'
        END
      ),
      "channel" = COALESCE(m."channel", c."channel", 'WHATSAPP'),
      "tenantId" = COALESCE(m."tenantId", c."tenantId", default_tenant_id),
      "unitId" = COALESCE(m."unitId", c."unitId", default_unit_id)
    FROM public."Conversation" c
    WHERE m."conversationId" = c.id;

    UPDATE public."Message"
    SET
      "body" = COALESCE("body", "content", ''),
      "direction" = COALESCE("direction", 'OUTBOUND'),
      "channel" = COALESCE("channel", 'WHATSAPP'),
      "tenantId" = COALESCE("tenantId", default_tenant_id),
      "unitId" = COALESCE("unitId", default_unit_id)
    WHERE "tenantId" IS NULL OR "unitId" IS NULL OR "body" IS NULL OR "direction" IS NULL OR "channel" IS NULL;

    ALTER TABLE public."Message"
      ALTER COLUMN "body" SET NOT NULL,
      ALTER COLUMN "direction" SET NOT NULL,
      ALTER COLUMN "channel" SET NOT NULL,
      ALTER COLUMN "tenantId" SET NOT NULL,
      ALTER COLUMN "unitId" SET NOT NULL;
  END IF;
END $$;
