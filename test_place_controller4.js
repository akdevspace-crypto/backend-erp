import { placeCandidate } from './src/modules/hr/service.js';
import { prisma } from './src/app/prisma.js';
import crypto from 'node:crypto';

async function main() {
  const testUnitId = 'd9d68a07-eb1d-43b7-9dc0-12ac3a5e1c2d';
  const testTenantId = 'f866c6e5-949b-4b6f-a137-0ba659918b34';
  
  const candidate = await prisma.candidate.create({
    data: {
      id: crypto.randomUUID(),
      serialNo: 'TEST-CAN-' + Date.now(),
      name: 'Test Candidate',
      mobileNo: '1234567890',
      tenantId: testTenantId,
      unitId: testUnitId,
      stage: 'INTERVIEW',
      updatedAt: new Date()
    }
  });

  try {
    const rawBody = {
      empId: 'EMP-100-' + Date.now(),
      designation: 'Nurse',
      department: 'General',
      joiningDate: ''
    };
    
    const staff = await placeCandidate(testTenantId, testUnitId, candidate.id, rawBody);
    console.log('Success!', staff.empId);
  } catch(e) {
    console.error('Error:', e);
  }
}

main().finally(() => prisma.$disconnect());
