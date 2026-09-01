import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.attendanceLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log("Recent AttendanceLogs:");
    console.log(JSON.stringify(logs, null, 2));
    
    const staff = await prisma.staff.findMany({
        take: 2,
        select: { id: true, empId: true, firstName: true, tenantId: true }
    });
    console.log("\nSome Staff:");
    console.log(JSON.stringify(staff, null, 2));

    const audit = await prisma.auditLog.findMany({
        where: { action: 'STAFF_CHECK_IN' },
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    console.log("\nRecent Security Staff Check-ins:");
    console.log(JSON.stringify(audit, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
