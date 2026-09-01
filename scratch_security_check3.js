import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const securityPerms = await prisma.permission.findMany({
        where: { module: 'SECURITY' }
    });
    console.log("Security Permissions:", securityPerms);

    const user = await prisma.user.findUnique({
        where: { id: '8f31d493-4fb3-47a2-8b14-22cb5c643add' },
        include: { staff: true, role: { include: { permissions: { include: { permission: true } } } } }
    });

    console.log("\nUser Details:");
    console.log(JSON.stringify(user, null, 2));

}

main().catch(console.error).finally(() => prisma.$disconnect());
