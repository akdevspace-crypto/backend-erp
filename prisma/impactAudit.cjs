const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAudit() {
  // 1 & 3: Find roles
  const securityManagerRole = await prisma.role.findFirst({
    where: { name: 'Security Manager' },
    include: {
      users: { select: { id: true } },
      permissions: { select: { id: true } }
    }
  });

  const securitySupervisorRole = await prisma.role.findFirst({
    where: { name: 'Security Supervisor' }
  });

  console.log("=== Role: Security Manager ===");
  if (securityManagerRole) {
    console.log({
      id: securityManagerRole.id,
      name: securityManagerRole.name,
      tenantId: securityManagerRole.tenantId,
      usersAssigned: securityManagerRole.users.length,
      permissionsAssigned: securityManagerRole.permissions.length
    });
  } else {
    console.log("Not found.");
  }

  console.log("\n=== Role: Security Supervisor ===");
  if (securitySupervisorRole) {
    console.log({ id: securitySupervisorRole.id, name: securitySupervisorRole.name });
  } else {
    console.log("Not found.");
  }

  // 2: Find all users assigned to Security Manager
  if (securityManagerRole) {
    console.log("\n=== Users Assigned to Security Manager ===");
    const users = await prisma.user.findMany({
      where: { roleId: securityManagerRole.id },
      include: {
        staff: true,
        unit: true
      }
    });

    users.forEach(user => {
      console.log({
        id: user.id,
        email: user.email,
        unitCode: user.unit?.code,
        unitName: user.unit?.name,
        linkedToStaff: !!user.staff,
        staffDesignation: user.staff?.designation
      });
    });
  }
}

runAudit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
