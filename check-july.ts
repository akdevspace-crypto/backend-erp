import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe('SELECT * FROM "PatientDailyCost" WHERE "costDate" >= \'2026-07-01\' AND "costDate" <= \'2026-07-31\'');
  console.log('Total entries in July:', result.length);
  if (result.length > 0) {
    console.log(JSON.stringify(result.slice(0, 5), null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
