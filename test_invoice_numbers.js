const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const invs = await prisma.invoice.findMany({ select: { refNo: true } });
  console.log(JSON.stringify(invs, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
