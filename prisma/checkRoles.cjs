const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoles() {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, description: true }
  });
  
  console.log("All Roles:");
  console.log(JSON.stringify(roles, null, 2));

  const users = await prisma.user.findMany({
    where: {
      email: { contains: 'frontdesk' }
    },
    include: { role: true }
  });

  console.log("Users with 'frontdesk' in email:");
  console.log(JSON.stringify(users, null, 2));
}

checkRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
