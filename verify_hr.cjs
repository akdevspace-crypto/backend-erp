require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + "connection_limit=1"
    }
  }
});

async function verifyHR() {
  try {
    const hrService = await import('./src/modules/hr/service.js');
    
    const tenantId = 'f866c6e5-949b-4b6f-a137-0ba659918b34';
    const unitId = 'd3bfe50c-edd5-4bd8-9d20-be37a84cdb2b';
    
    // Test if historical logs still render through the HR system
    const attendanceLogs = await hrService.getAttendanceLogs(tenantId, unitId, {
      date: '2026-08-06',
      scope: 'all'
    });

    const specificStaff = attendanceLogs.find(a => a.staffId === '4a352efb-d59b-4fb5-b5d9-977109f30d89');
    
    if (specificStaff && specificStaff.status === 'Present') {
      console.log('HR History check: PASSED. Rendered attendance correctly for historical date.');
      console.log(specificStaff);
    } else {
      console.error('HR History check FAILED. Did not find correct attendance state.');
      console.log(attendanceLogs);
    }

  } catch (err) {
    console.error('HR VERIFICATION FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyHR();
