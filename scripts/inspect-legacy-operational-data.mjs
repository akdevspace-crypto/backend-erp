import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";
dotenv.config();
const prisma = new PrismaClient();
for (const table of ["Customer","Agent","Conversation","User"]) {
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table}
    ORDER BY ordinal_position`;
  console.log('\n' + table + ' columns');
  console.table(columns);
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM public."${table}" LIMIT 3`);
  console.log(table + ' samples');
  console.dir(rows, { depth: null });
}
await prisma.$disconnect();
