import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

try {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const counts = [];
  for (const row of tables) {
    const tableName = row.table_name;
    try {
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public."${tableName}"`);
      counts.push({ table: tableName, count: result?.[0]?.count ?? 0 });
    } catch (error) {
      counts.push({ table: tableName, count: `ERROR: ${error?.message || error}` });
    }
  }

  const nonEmpty = counts.filter((row) => typeof row.count === 'number' && row.count > 0);
  console.log(JSON.stringify({ all: counts, nonEmpty }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
