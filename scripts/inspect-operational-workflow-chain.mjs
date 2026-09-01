import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const prisma = new PrismaClient();

const countTable = async (tableName) => {
  const exists = await prisma.$queryRaw`
    SELECT to_regclass(${`public."${tableName}"`})::text AS table_name
  `;

  if (!exists[0]?.table_name) return "MISSING";
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public."${tableName}"`);
  return rows[0]?.count ?? 0;
};

const sampleTable = async (tableName, orderColumn = "createdAt", limit = 5) => {
  const exists = await prisma.$queryRaw`
    SELECT to_regclass(${`public."${tableName}"`})::text AS table_name
  `;

  if (!exists[0]?.table_name) return [];

  try {
    return await prisma.$queryRawUnsafe(`
      SELECT *
      FROM public."${tableName}"
      ORDER BY "${orderColumn}" DESC
      LIMIT ${Number(limit)}
    `);
  } catch {
    return await prisma.$queryRawUnsafe(`
      SELECT *
      FROM public."${tableName}"
      LIMIT ${Number(limit)}
    `);
  }
};

try {
  const tables = [
    "Customer",
    "Conversation",
    "Message",
    "Client",
    "Enquiry",
    "FollowUp",
    "Patient",
    "Admission",
    "Allocation",
    "Task",
    "AccountTransaction",
    "Invoice",
    "Staff",
    "MedicalAssignment"
  ];

  const counts = {};
  for (const table of tables) {
    counts[table] = await countTable(table);
  }

  const enquiries = await prisma.enquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      refNo: true,
      status: true,
      isConverted: true,
      convertedAt: true,
      createdAt: true,
      rawMessage: true,
      client: {
        select: {
          name: true,
          mobile: true,
          email: true
        }
      },
      admission: {
        select: {
          id: true,
          status: true,
          admittedAt: true,
          patient: { select: { id: true, name: true } }
        }
      },
      allocation: {
        select: {
          id: true,
          refNo: true,
          type: true,
          status: true,
          staffId: true,
          metadata: true
        }
      },
      followUps: {
        select: {
          id: true,
          notes: true,
          scheduledAt: true,
          outcome: true,
          channel: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 3
      }
    }
  });

  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      refNo: true,
      title: true,
      status: true,
      enquiryId: true,
      assigneeId: true,
      assignedStaffId: true,
      description: true,
      createdAt: true,
      completedAt: true
    }
  });

  const allocations = await prisma.allocation.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      enquiry: { select: { refNo: true, client: { select: { name: true } } } },
      staff: { select: { empId: true, firstName: true, lastName: true, userId: true } }
    }
  });

  const invoices = await prisma.accountTransaction.findMany({
    where: { type: "INVOICE", isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  console.log(JSON.stringify({
    counts,
    latestEnquiryChains: enquiries,
    allocations,
    tasks,
    invoices,
    legacySamples: {
      Customer: await sampleTable("Customer"),
      Conversation: await sampleTable("Conversation"),
      Message: await sampleTable("Message")
    }
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
