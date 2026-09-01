import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: { role: true },
        where: { role: { name: 'SECURITY_STAFF' } }
    });
    
    console.log("Normal Security Users:", users.map(u => ({ email: u.email, unitId: u.unitId })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
