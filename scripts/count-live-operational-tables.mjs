import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";
dotenv.config();
const prisma = new PrismaClient();
const tables = ["Customer","Agent","WhatsappLog","Conversation","Message","Client","Enquiry","Allocation","Task","Staff","MedicalAssignment"];
for (const table of tables) {
  const exists = await prisma.$queryRaw`SELECT to_regclass(${`public."${table}"`})::text AS table_name`;
  if (!exists[0]?.table_name) { console.log(table, 'MISSING'); continue; }
  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public."${table}"`);
  console.log(table, count[0]?.count ?? 0);
}
await prisma.$disconnect();
