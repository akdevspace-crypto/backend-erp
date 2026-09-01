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
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id::text, name, phone, email, "createdAt", "updatedAt"
    FROM public."Customer"
    ORDER BY "createdAt" DESC
    LIMIT 50
  `);
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
