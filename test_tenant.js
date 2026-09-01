import { prisma } from './src/app/prisma.js';

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'Raghav@uec.com' },
        include: { role: true, staff: true, unit: true }
    });
    console.log('User Tenant:', user.tenantId);

    const allUnits = await prisma.unit.findMany({ where: { isDeleted: false }});
    console.log('All Units tenants:');
    allUnits.forEach(u => console.log(`- ${u.name} (tenantId: ${u.tenantId})`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
