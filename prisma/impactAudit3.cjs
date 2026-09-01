const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllSecManagers() {
  const roles = await prisma.role.findMany({
    where: { name: 'Security Manager' }
  });
  console.log(roles);
}
checkAllSecManagers().finally(() => prisma.$disconnect());
