import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const tables = process.argv.slice(2);

if (tables.length === 0) {
  console.error('Usage: node scripts/inspect-column-types.mjs <TableName> [...TableName]');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

try {
  const rows = await prisma.$queryRaw`
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${tables})
    ORDER BY table_name, ordinal_position
  `;

  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
