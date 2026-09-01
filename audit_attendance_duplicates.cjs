const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- ATTENDANCE LOG DUPLICATE AUDIT ---");
    
    // Group by staffId and date to find counts > 1
    const duplicates = await prisma.attendanceLog.groupBy({
        by: ['staffId', 'date'],
        _count: {
            id: true
        },
        having: {
            id: {
                _count: {
                    gt: 1
                }
            }
        }
    });

    if (duplicates.length === 0) {
        console.log("RESULT: No duplicate (staffId, date) pairs found in AttendanceLog.");
    } else {
        console.log(`RESULT: Found ${duplicates.length} duplicate (staffId, date) pairs!`);
        console.log(JSON.stringify(duplicates, null, 2));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
