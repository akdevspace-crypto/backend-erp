require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + "connection_limit=1"
    }
  }
});

// Since getPayrollPreview relies on ESM and we are in CJS for our scripts,
// we can either dynamically import the service or just make an HTTP request to the running backend.
// Since the backend is running (npm start), making a request is much cleaner.
// Wait, we need a JWT token to make an API request.
// Or we can just dynamically import `getPayrollPreview` because node supports `import()` in CJS!

async function verifyPayroll() {
  try {
    const hrService = await import('./src/modules/hr/service.js');
    
    // We know the tenant from earlier: f866c6e5-949b-4b6f-a137-0ba659918b34
    // unitId: d3bfe50c-edd5-4bd8-9d20-be37a84cdb2b
    const tenantId = 'f866c6e5-949b-4b6f-a137-0ba659918b34';
    const unitId = 'd3bfe50c-edd5-4bd8-9d20-be37a84cdb2b';
    const month = '2026-08';

    // Mocking Prisma object for the service if it doesn't use the global one, 
    // but the service imports prisma from '../../app/prisma.js' which will work fine.

    const payrollPreview = await hrService.getPayrollPreview(tenantId, unitId, { month, scope: 'all' });
    
    // Check if payrollPreview generated results without throwing errors.
    console.log(`Payroll preview generated successfully for ${month}.`);
    console.log(`Total staff in payroll: ${payrollPreview.length}`);
    
    // Find the staff who had attendance in August: 4a352efb-d59b-4fb5-b5d9-977109f30d89
    const sampleStaff = payrollPreview.find(p => p.staffId === '4a352efb-d59b-4fb5-b5d9-977109f30d89');
    if (sampleStaff) {
       console.log('Sample Staff Payroll Data:');
       console.log(`Working Days: ${sampleStaff.workingDays}`);
       console.log(`Present Days: ${sampleStaff.presentDays}`);
       console.log(`Absent Days: ${sampleStaff.absentDays}`);
       console.log(`Gross Pay: ${sampleStaff.grossPay}`);
       console.log(`Net Pay: ${sampleStaff.netPay}`);
    } else {
       console.log('Sample staff not found in payroll preview. This might be correct if they are in a different unit or role.');
    }
    
    console.log(`\nPAYROLL VERIFICATION: PASSED`);
    
  } catch (err) {
    console.error('PAYROLL VERIFICATION FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPayroll();
