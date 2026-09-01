import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const roles = await prisma.role.findMany();
    console.log("All roles:");
    roles.forEach(r => console.log(r.id, r.name));

    const users = await prisma.user.findMany({
        include: { role: true },
        where: { email: { contains: 'security' } } // Usually email is used instead of username
    });
    
    console.log("\nUsers with 'security' in email:");
    users.forEach(u => console.log(u.id, u.email, u.role?.name, "Unit:", u.unitId, "Tenant:", u.tenantId));
}

main().catch(console.error).finally(() => prisma.$disconnect());
