import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const prisma = new PrismaClient();

const tables = [
  "Enquiry",
  "FollowUp",
  "Patient",
  "Admission",
  "Allocation",
  "Task",
  "AccountTransaction",
  "Invoice",
  "RefCounter"
];

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
    ORDER BY table_name, ordinal_position
  `, tables);

  const grouped = rows.reduce((acc, row) => {
    acc[row.table_name] ||= [];
    acc[row.table_name].push(row);
    return acc;
  }, {});

  console.log(JSON.stringify(grouped, null, 2));
} finally {
  await prisma.$disconnect();
}
