import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const all = await prisma.$queryRaw`
    SELECT *
    FROM "PatientDailyCost"
    WHERE "patientName" ILIKE '%Josh%'
  `;
  console.log(JSON.stringify(all, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
