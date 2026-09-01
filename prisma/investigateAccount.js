const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccount() {
  const user = await prisma.user.findUnique({
    where: { email: 'shabana@frontdesk.unisenth.local' },
    include: {
      role: true,
      staffProfile: true,
      employeeProfile: true,
      permissions: true
    }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  const safeUser = {
    id: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role?.name,
    staffId: user.staffId,
    empId: user.empId,
    hasStaffProfile: !!user.staffProfile,
    hasEmployeeProfile: !!user.employeeProfile,
    staffProfileId: user.staffProfile?.id,
    employeeProfileId: user.employeeProfile?.id,
    unitId: user.unitId,
    unitAccess: user.unitAccess,
    menuPrivilege: user.menuPrivilege,
    permissionsCount: user.permissions?.length || 0,
    permissions: user.permissions?.map(p => p.permissionName || p.name)
  };
  
  console.log(JSON.stringify(safeUser, null, 2));
}

checkAccount()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
