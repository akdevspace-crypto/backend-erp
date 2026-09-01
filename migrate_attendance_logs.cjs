const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');

const normalizeDateToUTC = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

async function main() {
    console.log(`--- ATTENDANCE LOG MIGRATION ${isDryRun ? '(DRY RUN)' : '(EXECUTE)'} ---`);

    const staffs = await prisma.staff.findMany({
        select: {
            id: true,
            tenantId: true,
            unitId: true,
            metadata: true,
            attendanceLogs: {
                select: { date: true, id: true }
            }
        }
    });

    let found = 0;
    let valid = 0;
    let invalid = 0;
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const staff of staffs) {
        const metadata = typeof staff.metadata === 'string' ? JSON.parse(staff.metadata) : staff.metadata;
        if (!metadata || !metadata.attendance || !Array.isArray(metadata.attendance.logs)) {
            continue;
        }

        const legacyLogs = metadata.attendance.logs;
        found += legacyLogs.length;

        for (const log of legacyLogs) {
            try {
                const dateRaw = log.date || log.attendanceDate || log.day;
                const normalizedDate = normalizeDateToUTC(dateRaw);

                if (!normalizedDate) {
                    invalid++;
                    console.log(`[INVALID] Staff ${staff.id} legacy log has invalid date: ${dateRaw}`);
                    continue;
                }

                valid++;

                // Check for duplicate in existing relational logs
                const exists = staff.attendanceLogs.some(
                    (r) => r.date.getTime() === normalizedDate.getTime()
                );

                if (exists) {
                    skipped++;
                    continue;
                }

                const checkIn = log.checkIn ? new Date(log.checkIn) : null;
                const checkOut = log.checkOut ? new Date(log.checkOut) : null;
                const status = log.status || 'Present';
                
                // Preserve the legacy log as metadata in the new relational record
                const logMetadata = { ...log, migratedFromLegacy: true };

                if (!isDryRun) {
                    await prisma.attendanceLog.create({
                        data: {
                            staffId: staff.id,
                            date: normalizedDate,
                            checkIn,
                            checkOut,
                            status,
                            method: log.method || 'Manual',
                            metadata: logMetadata,
                            tenantId: staff.tenantId,
                            unitId: staff.unitId || staff.tenantId,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    });
                    inserted++;
                    // Add to in-memory list to prevent duplicates in the same run
                    staff.attendanceLogs.push({ date: normalizedDate, id: 'temp' });
                } else {
                    inserted++;
                }

            } catch (err) {
                errors++;
                console.error(`[ERROR] Staff ${staff.id} failed to migrate log:`, err.message);
            }
        }
    }

    console.log(`\n--- MIGRATION SUMMARY ---`);
    console.log(`Found: ${found}`);
    console.log(`Valid: ${valid}`);
    console.log(`Invalid: ${invalid}`);
    console.log(`Inserted (Simulated if Dry-Run): ${inserted}`);
    console.log(`Skipped duplicates: ${skipped}`);
    console.log(`Errors: ${errors}`);
    
    if (isDryRun) {
        console.log(`\nTo execute this migration, run: node migrate_attendance_logs.cjs --execute`);
    } else {
        console.log(`\nSUCCESSFULLY EXECUTED.`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
