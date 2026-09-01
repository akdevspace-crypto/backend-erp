import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.patientDailyCost.findMany({
    select: {
      patientName: true,
      costDate: true,
      amount: true
    }
  });
  console.log(JSON.stringify(entries, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
