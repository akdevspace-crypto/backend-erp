import crypto from "node:crypto";
import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const prisma = new PrismaClient();

const pad = (value, size = 6) => String(value).padStart(size, "0");
const text = (value) => (value == null ? null : String(value));

const getDefaultContext = async () => {
  const rows = await prisma.$queryRaw`
    SELECT t.id AS "tenantId", u.id AS "unitId"
    FROM public."Tenant" t
    CROSS JOIN public."Unit" u
    ORDER BY t."createdAt" ASC, u."createdAt" ASC
    LIMIT 1
  `;

  if (!rows[0]?.tenantId || !rows[0]?.unitId) {
    throw new Error("Cannot backfill: Tenant or Unit is missing.");
  }

  return {
    tenantId: text(rows[0].tenantId),
    unitId: text(rows[0].unitId)
  };
};

const backfillClients = async ({ tenantId, unitId }) => {
  const customers = await prisma.$queryRaw`
    SELECT id, name, phone, email, "createdAt", "updatedAt"
    FROM public."Customer"
    ORDER BY "createdAt" ASC
  `;

  let created = 0;

  for (let index = 0; index < customers.length; index += 1) {
    const customer = customers[index];
    const clientId = text(customer.id);
    const refNo = `LEG-CLI-${pad(index + 1)}`;

    const result = await prisma.$executeRaw`
      INSERT INTO public."Client" (
        "id", "refNo", "name", "mobile", "email", "address",
        "tenantId", "unitId", "isDeleted", "createdAt", "updatedAt"
      )
      VALUES (
        ${clientId}, ${refNo}, ${customer.name}, ${customer.phone}, ${customer.email}, NULL,
        ${tenantId}, ${unitId}, false, ${customer.createdAt}, ${customer.updatedAt}
      )
      ON CONFLICT ("id") DO NOTHING
    `;

    created += Number(result);
  }

  return created;
};

const backfillEnquiries = async ({ tenantId, unitId }) => {
  const conversations = await prisma.$queryRaw`
    SELECT
      c.id,
      c."customerId",
      c.channel,
      c.status::text AS status,
      c.priority::text AS priority,
      c."createdAt",
      c."updatedAt",
      m.body AS "lastBody"
    FROM public."Conversation" c
    LEFT JOIN LATERAL (
      SELECT COALESCE("body", "content") AS body
      FROM public."Message"
      WHERE "conversationId" = c.id
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) m ON true
    ORDER BY c."createdAt" ASC
  `;

  let created = 0;

  for (let index = 0; index < conversations.length; index += 1) {
    const conversation = conversations[index];
    const enquiryId = text(conversation.id);
    const clientId = text(conversation.customerId);
    const refNo = `LEG-ENQ-${pad(index + 1)}`;
    const status = conversation.status === "CLOSED" || conversation.status === "RESOLVED" ? "CLOSED" : "NEW";
    const description = conversation.lastBody || `Legacy ${conversation.channel || "omnichannel"} conversation`;

    const result = await prisma.$executeRaw`
      INSERT INTO public."Enquiry" (
        "id", "refNo", "clientId", "mode", "source", "channelId", "rawMessage",
        "description", "status", "priority", "tenantId", "unitId",
        "isDeleted", "createdAt", "updatedAt"
      )
      VALUES (
        ${enquiryId}, ${refNo}, ${clientId}, ${conversation.channel}, 'LEGACY_OMNICHANNEL',
        ${enquiryId}, ${description}, ${description}, ${status}::public."EnquiryStatus",
        ${conversation.priority || "NORMAL"}, ${tenantId}, ${unitId},
        false, ${conversation.createdAt}, ${conversation.updatedAt}
      )
      ON CONFLICT ("id") DO NOTHING
    `;

    created += Number(result);
  }

  return created;
};

const backfillStaff = async ({ tenantId, unitId }) => {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT ON (u.id)
      u.id AS "userId",
      COALESCE(a.name, u."firstName") AS name,
      u."lastName",
      u.email,
      COALESCE(a.phone, u.mobile) AS phone,
      COALESCE(a.department, 'Operations') AS department,
      COALESCE(a."employeeId", 'EMP-' || substring(u.id::text from 1 for 8)) AS "empId",
      COALESCE(a."joinedAt", u."createdAt") AS "joinedAt",
      COALESCE(a.status::text, 'AVAILABLE') AS "agentStatus"
    FROM public."User" u
    LEFT JOIN public."Agent" a ON a."userId" = u.id AND COALESCE(a."isDeleted", false) = false
    WHERE
      a.id IS NOT NULL
      OR lower(u.email) LIKE '%test.staff%'
      OR lower(u.email) LIKE '%patientcare%'
      OR lower(u.email) LIKE '%monitor%'
    ORDER BY u.id, a."createdAt" DESC NULLS LAST
  `;

  let created = 0;

  for (const row of rows) {
    const staffId = crypto.randomUUID();
    const names = String(row.name || "Staff").trim().split(/\s+/);
    const firstName = names[0] || "Staff";
    const lastName = row.lastName || names.slice(1).join(" ") || "";
    const isAvailable = row.agentStatus !== "OFFLINE";

    const result = await prisma.$executeRaw`
      INSERT INTO public."Staff" (
        "id", "empId", "firstName", "lastName", "designation", "department",
        "phone", "email", "joiningDate", "status", "userId", "isAvailable",
        "tenantId", "unitId", "isDeleted", "createdAt", "updatedAt"
      )
      VALUES (
        ${staffId}, ${row.empId}, ${firstName}, ${lastName}, 'Nurse', ${row.department},
        ${row.phone}, ${row.email}, ${row.joinedAt}, 'Working', CAST(${row.userId} AS uuid), ${isAvailable},
        ${tenantId}, ${unitId}, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId") DO NOTHING
    `;

    created += Number(result);
  }

  return created;
};

try {
  const context = await getDefaultContext();
  const clients = await backfillClients(context);
  const enquiries = await backfillEnquiries(context);
  const staff = await backfillStaff(context);

  console.log(JSON.stringify({ clients, enquiries, staff }, null, 2));
} finally {
  await prisma.$disconnect();
}
