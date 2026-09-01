import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe('SELECT * FROM "PatientDailyCost" WHERE "patientName" ILIKE \'%rosi%\' OR "patientName" ILIKE \'%rosiline%\'');
  console.log('Total entries for Rosiline:', result.length);
  if (result.length > 0) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
