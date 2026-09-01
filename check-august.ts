import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe('SELECT "patientName", "clientName", "costDate" FROM "PatientDailyCost" WHERE "costDate" >= \'2026-08-01\'');
  console.log('Total entries in August:', result.length);
  if (result.length > 0) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
