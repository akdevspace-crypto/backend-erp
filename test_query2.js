import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const joshline = await prisma.$queryRaw`
    SELECT id, "patientName", "costDate", amount, status, "isDeleted", "invoiceRefNo"
    FROM "PatientDailyCost"
    WHERE "patientName" ILIKE '%Josh%'
  `;
  console.log(joshline);
}
main().catch(console.error).finally(() => prisma.$disconnect());
