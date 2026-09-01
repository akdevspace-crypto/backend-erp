import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";
dotenv.config();
const prisma = new PrismaClient();
const tables = ["Tenant","Unit","User","Role","AccountTransaction","Invoice","RefCounter"];
for (const table of tables) {
  const rows = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table}
      AND column_name IN ('id','tenantId','unitId','roleId','userId','allocationId')
    ORDER BY ordinal_position`;
  console.log(table, rows);
}
await prisma.$disconnect();
