import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const prisma = new PrismaClient();

const defaultPermissions = {
  "My Profile": { view: true, createUpdate: false },
  "Daily Task": { view: true, createUpdate: true },
  "Profile Task Dashboard": { view: true, createUpdate: false },
  Notifications: { view: true, createUpdate: false }
};

try {
  const result = await prisma.$executeRaw`
    UPDATE public."Staff"
    SET "metadata" = jsonb_set(
      COALESCE("metadata", '{}'::jsonb),
      '{menuPrivilege}',
      ${JSON.stringify({
        unitAccessMode: "all",
        selectedUnitIds: [],
        permissions: defaultPermissions,
        configuredBy: "repair-seed"
      })}::jsonb || jsonb_build_object('configuredAt', CURRENT_TIMESTAMP::text),
      true
    ),
    "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" IS NOT NULL
      AND COALESCE("isDeleted", false) = false
      AND (
        "metadata" IS NULL
        OR "metadata"->'menuPrivilege' IS NULL
        OR "metadata"->'menuPrivilege' = 'null'::jsonb
      )
  `;

  console.log(`Seeded menu privilege metadata for ${Number(result)} staff record(s).`);
} finally {
  await prisma.$disconnect();
}
