import { prisma } from './src/app/prisma.js';
import { placeCandidate } from './src/modules/hr/service.js';

async function main() {
  const candidate = await prisma.candidate.findFirst({ where: { unitId: { not: null }, isPlaced: false } });
  if (!candidate) return console.log('No candidate found to place');
  console.log('Placing candidate:', candidate.id);
  
  try {
    const data = {
      empId: 'EMP-TEST-' + Date.now(),
      designation: 'Nurse',
      department: 'General',
      joiningDate: new Date().toISOString()
    };
    
    await placeCandidate(candidate.tenantId, candidate.unitId, candidate.id, data);
    console.log('Candidate placed successfully');
    
  } catch(e) {
    console.error('Error during placement test:', e);
  }
}

main().finally(() => prisma.$disconnect());
