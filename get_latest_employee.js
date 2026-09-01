import { prisma } from './src/app/prisma.js';

async function getLatestEmployee() {
  try {
    const latestStaff = await prisma.staff.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    
    if (latestStaff) {
      console.log('--- LATEST EMPLOYEE ---');
      console.log(`Staff ID: ${latestStaff.id}`);
      console.log(`Emp ID: ${latestStaff.empId}`);
      console.log(`Name: ${latestStaff.firstName} ${latestStaff.lastName || ''}`);
      console.log(`User ID (userId): ${latestStaff.userId || 'NULL (No user linked)'}`);
    } else {
      console.log('No employees found in the database.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getLatestEmployee();
