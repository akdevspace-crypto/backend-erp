import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const roleIds = [
        '30fac3c0-c5a7-4d5c-9df4-520db482f098', // Security Supervisor
        'd25756a3-4fc4-40bd-b17c-e6a63d6b9e10', // Security Manager
        'c0829a8f-09ca-43c2-94b8-2eece7871b9a'  // SECURITY_STAFF
    ];

    const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        include: {
            permissions: {
                include: { permission: true }
            }
        }
    });

    roles.forEach(r => {
        console.log(`\nRole: ${r.name}`);
        r.permissions.forEach(rp => {
            console.log(`  - ${rp.permission.module} ${rp.permission.action}`);
        });
    });

    const user = await prisma.user.findUnique({
        where: { id: '8f31d493-4fb3-47a2-8b14-22cb5c643add' },
        include: { staff: { include: { menuPrivilege: true } } }
    });

    console.log("\nUser Staff metadata:");
    console.log(JSON.stringify(user?.staff, null, 2));

}

main().catch(console.error).finally(() => prisma.$disconnect());
