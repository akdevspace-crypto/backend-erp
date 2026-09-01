const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runFix() {
  const email = 'shabana@frontdesk.unisenth.local';

  console.log("=== STEP 1: VERIFY CURRENT STATE ===");
  const userBefore = await prisma.user.findUnique({
    where: { email },
    include: { role: true, staff: true, unit: true }
  });

  if (!userBefore) throw new Error("User not found!");
  
  console.log("User Before:", {
    id: userBefore.id,
    email: userBefore.email,
    roleId: userBefore.roleId,
    roleName: userBefore.role?.name,
    tenantId: userBefore.tenantId,
    unitId: userBefore.unitId,
    staffId: userBefore.staff?.id
  });

  const targetRole = await prisma.role.findFirst({
    where: { name: 'Security Supervisor', tenantId: userBefore.tenantId }
  });
  if (!targetRole) throw new Error("Target Role not found!");
  
  const sourceRole = await prisma.role.findFirst({
    where: { id: userBefore.roleId }
  });
  if (!sourceRole || sourceRole.name !== 'Security Manager') throw new Error("Source Role mismatch!");

  console.log("Target Role:", targetRole);
  console.log("Source Role:", sourceRole);

  if (targetRole.tenantId !== sourceRole.tenantId) throw new Error("Tenant mismatch between roles!");

  console.log("\n=== STEP 2: MIGRATE ONLY SHABANA ===");
  const updatedUser = await prisma.user.updateMany({
    where: {
      email: email,
      roleId: sourceRole.id
    },
    data: {
      roleId: targetRole.id
    }
  });
  console.log("Updated count:", updatedUser.count);
  if (updatedUser.count !== 1) throw new Error("Failed to update exactly 1 user!");

  console.log("\n=== STEP 3: VERIFY DATABASE RESULT ===");
  const userAfter = await prisma.user.findUnique({
    where: { email },
    include: { role: true, staff: true, unit: true }
  });

  console.log("User After:", {
    id: userAfter.id,
    email: userAfter.email,
    roleId: userAfter.roleId,
    roleName: userAfter.role?.name,
    tenantId: userAfter.tenantId,
    unitId: userAfter.unitId,
    staffId: userAfter.staff?.id
  });

  console.log("\n=== STEP 4: OLD ROLE STATUS ===");
  const oldRoleCheck = await prisma.role.findUnique({ where: { id: sourceRole.id }});
  console.log("Old Role Still Exists:", !!oldRoleCheck);
}

runFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
