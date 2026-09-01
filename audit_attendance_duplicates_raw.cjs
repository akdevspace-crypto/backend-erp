const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
    console.log("--- ATTENDANCE LOG DUPLICATE AUDIT ---");
    const duplicates = await prisma.$queryRaw`SELECT "staffId", "date", COUNT(id) FROM "AttendanceLog" GROUP BY "staffId", "date" HAVING COUNT(id) > 1`;

    if (duplicates.length === 0) {
        console.log("RESULT: No duplicate (staffId, date) pairs found in AttendanceLog.");
    } else {
        console.log("RESULT: Found duplicates:", duplicates);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
