import { prisma } from './src/app/prisma.js';

async function seed() {
    try {
        let tenant = await prisma.tenant.findFirst();
        if (!tenant) tenant = await prisma.tenant.create({ data: { name: 'Test Tenant' } });
        
        let unit = await prisma.unit.findFirst();
        if (!unit) unit = await prisma.unit.create({ data: { name: 'Test Unit', tenantId: tenant.id } });

        let patient = await prisma.patient.findFirst();
        if (!patient) patient = await prisma.patient.create({ data: { name: 'Test Patient', tenantId: tenant.id, unitId: unit.id } });

        const account = await prisma.patientPortalAccount.upsert({
            where: { mobile: '1234567890' },
            update: { password: 'password123' },
            create: {
                mobile: '1234567890',
                password: 'password123',
                name: 'Test Family Member',
                patientId: patient.id,
                tenantId: tenant.id,
                unitId: unit.id
            }
        });
        
        console.log('Created test account: Mobile: 1234567890, Password: password123');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
seed();
