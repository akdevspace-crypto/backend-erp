import { prisma } from './src/app/prisma.js';
import { resolveUserAccess } from './src/modules/auth/access.js';

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'Raghav@uec.com' },
        include: { role: true, staff: true, unit: true }
    });
    if (!user) {
        console.log('User not found');
        return;
    }
    console.log('User:', { id: user.id, email: user.email, role: user.role?.name, staffId: user.staffId });
    
    const access = resolveUserAccess(user);
    console.log('Access:', JSON.stringify(access, null, 2));

    const allUnits = await prisma.unit.findMany({ where: { isDeleted: false }});
    console.log('Total Units:', allUnits.length);

    const authorizedUnits = allUnits.filter(unit => {
        const hasAllAccess = access.permissions?.includes('ALL_ACCESS') || access.unitAccess?.includes('*');
        if (hasAllAccess) return true;
        return access.unitAccess?.includes(unit.id);
    });

    console.log('Authorized Units:', authorizedUnits.map(u => u.name));
}
main().catch(console.error).finally(() => prisma.$disconnect());
