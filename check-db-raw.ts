import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe('SELECT * FROM "PatientDailyCost"');
  console.log('Total entries:', result.length);
  if (result.length > 0) {
    console.log(JSON.stringify(result.slice(0, 5), null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
