import { placeCandidate } from './src/modules/hr/service.js';
import { prisma } from './src/app/prisma.js';

async function main() {
  let candidate = await prisma.candidate.findFirst();
  if (!candidate) return console.log('No candidate found');
  
  if (candidate.isPlaced) {
    await prisma.candidate.update({ where: { id: candidate.id }, data: { isPlaced: false, unitId: 'd9d68a07-eb1d-43b7-9dc0-12ac3a5e1c2d' }});
    candidate.isPlaced = false;
    candidate.unitId = 'd9d68a07-eb1d-43b7-9dc0-12ac3a5e1c2d';
  }

  try {
    const rawBody = {
      empId: 'EMP-100',
      designation: 'Nurse',
      department: 'General',
      joiningDate: '2026-08-23T00:00:00.000Z'
    };
    
    const staff = await placeCandidate(candidate.tenantId, candidate.unitId, candidate.id, rawBody);
    console.log('Success!', staff.empId);
  } catch(e) {
    console.error('Error:', e);
  }
}

main().finally(() => prisma.$disconnect());
