const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const staff = await prisma.staff.findMany({
        select: { id: true, firstName: true, unitId: true, isDeleted: true, status: true, tenantId: true }
    });
    console.log(JSON.stringify(staff, null, 2));
}
main().finally(() => prisma.$disconnect());
