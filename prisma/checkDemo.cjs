const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDemo() {
  const user = await prisma.user.findUnique({
    where: { email: 'frontdesk@demo.com' },
    include: { role: true, staff: true }
  });
  console.log("Demo Frontdesk:", JSON.stringify(user, null, 2));
}
checkDemo().catch(console.error).finally(() => prisma.$disconnect());
