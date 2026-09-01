const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccount() {
  const user = await prisma.user.findUnique({
    where: { email: 'shabana@frontdesk.unisenth.local' },
    include: {
      role: true,
      staff: true
    }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  const safeUser = {
    roleName: user.role?.name,
    rolePermissions: user.role?.permissions,
    menuPrivilege: user.menuPrivilege
  };
  
  console.log(JSON.stringify(safeUser, null, 2));
}

checkAccount()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
