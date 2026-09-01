const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSecuritySupervisor() {
  const role = await prisma.role.findFirst({
    where: { name: 'Security Supervisor' }
  });
  console.log(role);
}

checkSecuritySupervisor()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
