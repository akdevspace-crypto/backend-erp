import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const prisma = new PrismaClient();

const inspect = async (tableName) => {
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;

  const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public."${tableName}"`);

  return {
    table: tableName,
    count: countResult[0]?.count ?? 0,
    columns
  };
};

try {
  console.dir(await inspect("Conversation"), { depth: null });
  console.dir(await inspect("Message"), { depth: null });
} finally {
  await prisma.$disconnect();
}
