import { prisma } from './src/app/prisma.js';

async function fixHRPermissions() {
  const users = await prisma.user.findMany({
    where: { isDeleted: false, role: { name: 'HR Manager' } },
    include: { staff: true, role: true }
  });
  
  const hrManager = users[0];
  
  if (!hrManager || !hrManager.staff) {
      console.log('No HR Manager staff record found.');
      return;
  }
  
  const hrRolePermissions = [
      'HR Manager Dashboard', 'Human Resource', 'Staff Management', 'Staff Privilege', 'Leave Management',
      'Shift Roster', 'Document Tracker', 'Training Compliance', 'Labour Mgt', 'Recruitment',
      'Job Enquiry', 'Attendance', 'Holiday Mapping', 'Payroll', 'HR Reports'
  ];
  
  const permissionsMap = {};
  for (const perm of hrRolePermissions) {
      permissionsMap[perm] = { view: true, createUpdate: true };
  }

  const metadata = hrManager.staff.metadata && typeof hrManager.staff.metadata === 'object' ? hrManager.staff.metadata : {};
  const updatedMetadata = {
      ...metadata,
      menuPrivilege: {
          ...(metadata.menuPrivilege || {}),
          unitAccessMode: 'all',
          permissions: permissionsMap,
          configuredAt: new Date().toISOString()
      }
  };

  await prisma.staff.update({
      where: { id: hrManager.staff.id },
      data: { metadata: updatedMetadata }
  });
  
  console.log('Restored HR permissions and kept unitAccessMode="all"');
}

fixHRPermissions().catch(console.error).finally(() => prisma.$disconnect());
