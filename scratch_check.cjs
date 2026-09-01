const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
    console.log('PayrollRecords:', await prisma.payrollRecord.count());
    console.log('StaffSalaries:', await prisma.staffSalary.count());
}

main().finally(() => prisma.$disconnect());
