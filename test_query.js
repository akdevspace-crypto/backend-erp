import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const all = await prisma.$queryRaw`SELECT "id" FROM "PatientDailyCost" LIMIT 2`;
  console.log('All ids:', all);
  if (all.length > 0) {
    const ids = all.map(row => row.id);
    try {
      const entries = await prisma.$queryRaw`
        SELECT "id" FROM "PatientDailyCost"
        WHERE "id" = ANY(${ids})
      `;
      console.log('Found with ANY():', entries.length);
    } catch (err) {
      console.log('Error with ANY():', err.message);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
