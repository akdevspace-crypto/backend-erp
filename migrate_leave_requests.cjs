const fs = require('fs');

async function main() {
    const isExecute = process.argv.includes('--execute');
    const { PrismaClient } = await import('./src/generated/prisma/index.js');
    const prisma = new PrismaClient();

    console.log(`Starting Leave Request Migration in ${isExecute ? 'EXECUTE' : 'DRY-RUN'} mode...`);

    let discovered = 0;
    let valid = 0;
    let invalid = 0;
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    const staffList = await prisma.staff.findMany({
        where: { isDeleted: false },
        select: { id: true, empId: true, tenantId: true, unitId: true, metadata: true }
    });

    for (const staff of staffList) {
        if (!staff.metadata || typeof staff.metadata !== 'object') continue;
        if (!Array.isArray(staff.metadata.leaveRequests)) continue;

        for (const req of staff.metadata.leaveRequests) {
            discovered++;

            if (!req.leaveType || (!req.fromDate && !req.startDate) || !req.status) {
                invalid++;
                continue;
            }

            const fromDateObj = new Date(req.fromDate || req.startDate);
            const toDateObj = new Date(req.toDate || req.endDate || req.fromDate || req.startDate);
            
            if (Number.isNaN(fromDateObj.getTime()) || Number.isNaN(toDateObj.getTime())) {
                invalid++;
                continue;
            }

            valid++;

            // Use authoritative parent Staff values
            const tenantId = staff.tenantId;
            const unitId = staff.unitId;
            const staffId = staff.id;
            
            // Try to find if it exists
            const existing = await prisma.leaveRequest.findFirst({
                where: {
                    staffId: staffId,
                    startDate: fromDateObj,
                    endDate: toDateObj,
                    leaveType: req.leaveType,
                    status: req.status
                }
            });

            if (existing) {
                skipped++;
                continue;
            }

            if (isExecute) {
                try {
                    await prisma.leaveRequest.create({
                        data: {
                            id: req.id || undefined, // Try to preserve ID if provided and unique
                            staffId: staffId,
                            tenantId: tenantId,
                            unitId: unitId,
                            leaveType: req.leaveType.trim(),
                            startDate: fromDateObj,
                            endDate: toDateObj,
                            reason: req.reason || '',
                            status: req.status,
                            requestedBy: req.requestedBy || null,
                            approvedBy: req.approvedBy || req.decidedBy || null,
                            remarks: req.remarks || '',
                            createdAt: req.createdAt ? new Date(req.createdAt) : new Date(),
                            updatedAt: req.updatedAt || req.decidedAt ? new Date(req.updatedAt || req.decidedAt) : new Date()
                        }
                    });
                    inserted++;
                } catch (err) {
                    console.error(`Failed to insert record for staff ${staff.empId}:`, err.message);
                    failed++;
                }
            }
        }
    }

    console.log('--- Migration Summary ---');
    console.log(`Discovered: ${discovered}`);
    console.log(`Valid:      ${valid}`);
    console.log(`Invalid:    ${invalid}`);
    console.log(`Inserted:   ${inserted}`);
    console.log(`Skipped:    ${skipped}`);
    console.log(`Failed:     ${failed}`);

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
