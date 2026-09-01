const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const staffs = await prisma.staff.findMany({ select: { metadata: true } });
    let historicalCount = 0;
    let totalStaffWithHistory = 0;
    staffs.forEach(s => {
        const m = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata;
        if (m && m.attendance && m.attendance.logs) {
            const count = m.attendance.logs.length;
            historicalCount += count;
            if (count > 0) totalStaffWithHistory++;
        }
    });
    console.log('Total Staff with Legacy History:', totalStaffWithHistory);
    console.log('Total Historical Records:', historicalCount);
    const relationalCount = await prisma.attendanceLog.count();
    console.log('Relational AttendanceLog Count:', relationalCount);
}
main().finally(() => prisma.$disconnect());
