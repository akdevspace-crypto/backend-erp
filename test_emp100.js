import { prisma } from './src/app/prisma.js';
async function main() {
  const staff = await prisma.staff.findUnique({ where: { empId: 'EMP-100' } });
  console.log('Staff EMP-100 exists?', !!staff);
}
main().finally(() => prisma.$disconnect());
