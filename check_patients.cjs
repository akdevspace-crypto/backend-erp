const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function run() {
    try {
        const total = await prisma.patient.count();
        console.log('Total Patients:', total);
        
        const byTenant = await prisma.patient.groupBy({ by: ['tenantId'], _count: true });
        console.log('By Tenant:', JSON.stringify(byTenant, null, 2));
        
        const byUnit = await prisma.patient.groupBy({ by: ['unitId'], _count: true });
        console.log('By Unit:', JSON.stringify(byUnit, null, 2));

        const active = await prisma.patient.count({ where: { status: 'ACTIVE' } });
        console.log('Active Patients:', active);

        const inactive = await prisma.patient.count({ where: { status: { not: 'ACTIVE' } } });
        console.log('Inactive Patients:', inactive);

        const admitted = await prisma.patient.count({ where: { isAdmitted: true } });
        console.log('Admitted Patients:', admitted);

        const discharged = await prisma.patient.count({ where: { isAdmitted: false } });
        console.log('Discharged/Not Admitted Patients:', discharged);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
