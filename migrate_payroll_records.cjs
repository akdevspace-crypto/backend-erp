const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

const isDryRun = !process.argv.includes('--execute');

function isValidMonth(month) {
    return /^\d{4}-\d{2}$/.test(month);
}

function parseNumber(val, defaultVal = null) {
    if (val === null || val === undefined) return defaultVal;
    const num = Number(val);
    if (isNaN(num)) return defaultVal;
    return num;
}

function parseMetadata(rawMeta) {
    if (!rawMeta) return {};
    if (typeof rawMeta === 'string') {
        try {
            return JSON.parse(rawMeta);
        } catch (e) {
            return {};
        }
    }
    if (typeof rawMeta === 'object') return rawMeta;
    return {};
}

async function migrate() {
    console.log(`Starting Historical Payroll Migration - ${isDryRun ? 'DRY RUN' : 'EXECUTE'} MODE`);
    console.log('------------------------------------------------------------');

    let totalStaffFound = 0;
    let expectedRecords = 0;
    let validRecords = 0;
    let invalidRecords = 0;
    let skippedDuplicates = 0;
    let insertedRecords = 0;

    let tenantCounts = {};
    let unitCounts = {};
    let invalidReasons = [];

    const allStaff = await prisma.staff.findMany({
        where: { metadata: { not: null } },
        select: { id: true, tenantId: true, unitId: true, metadata: true }
    });

    totalStaffFound = allStaff.length;

    for (const staff of allStaff) {
        const metadata = parseMetadata(staff.metadata);
        if (metadata && metadata.payroll && metadata.payroll.records) {
            const recordsObj = metadata.payroll.records;
            for (const [monthKey, record] of Object.entries(recordsObj)) {
                expectedRecords++;

                if (!isValidMonth(monthKey)) {
                    invalidRecords++;
                    invalidReasons.push(`Staff ${staff.id} - Invalid month format: ${monthKey}`);
                    continue;
                }
                if (record.month && record.month !== monthKey) {
                    invalidRecords++;
                    invalidReasons.push(`Staff ${staff.id} - Mismatched month: key ${monthKey} != record ${record.month}`);
                    continue;
                }

                // Validate required fields
                const workingDays = parseNumber(record.workingDays);
                const presentDays = parseNumber(record.presentDays);
                const approvedLeaveDays = parseNumber(record.approvedLeaveDays);
                const absentDays = parseNumber(record.absentDays);
                const baseSalary = parseNumber(record.baseSalary);
                const fixedAllowance = parseNumber(record.fixedAllowance);
                const fixedDeduction = parseNumber(record.fixedDeduction);
                const grossPay = parseNumber(record.grossPay);
                const deductions = parseNumber(record.deductions);
                const netPay = parseNumber(record.netPay);

                if ([workingDays, presentDays, approvedLeaveDays, absentDays, baseSalary, fixedAllowance, fixedDeduction, grossPay, deductions, netPay].some(v => v === null)) {
                    invalidRecords++;
                    invalidReasons.push(`Staff ${staff.id} - Missing required numeric fields for month ${monthKey}`);
                    continue;
                }

                if (!record.status) {
                    invalidRecords++;
                    invalidReasons.push(`Staff ${staff.id} - Missing status for month ${monthKey}`);
                    continue;
                }

                // Duplicate check
                const existing = await prisma.payrollRecord.findUnique({
                    where: { staffId_month: { staffId: staff.id, month: monthKey } }
                });

                if (existing) {
                    skippedDuplicates++;
                    continue;
                }

                validRecords++;

                tenantCounts[staff.tenantId] = (tenantCounts[staff.tenantId] || 0) + 1;
                if (staff.unitId) {
                    unitCounts[staff.unitId] = (unitCounts[staff.unitId] || 0) + 1;
                }

                if (isDryRun) {
                    console.log(`[DRY RUN] Would insert PayrollRecord for Staff: ${staff.id}, Month: ${monthKey}`);
                    console.log(`          Tenant: ${staff.tenantId} | Unit: ${staff.unitId}`);
                    console.log(`          Gross: ${grossPay} | Net: ${netPay} | Status: ${record.status}`);
                } else {
                    try {
                        let processedAt = null;
                        if (record.processedAt) {
                            processedAt = new Date(record.processedAt);
                            if (isNaN(processedAt.getTime())) processedAt = null;
                        }

                        await prisma.payrollRecord.create({
                            data: {
                                staffId: staff.id,
                                tenantId: staff.tenantId,
                                unitId: staff.unitId || '',
                                month: monthKey,
                                workingDays,
                                presentDays,
                                approvedLeaveDays,
                                absentDays,
                                baseSalary,
                                fixedAllowance,
                                fixedDeduction,
                                grossPay,
                                deductions,
                                netPay,
                                status: record.status,
                                processedAt,
                                processedBy: record.processedBy || null
                            }
                        });
                        insertedRecords++;
                        console.log(`[EXECUTE] Inserted PayrollRecord for Staff: ${staff.id}, Month: ${monthKey}`);
                    } catch (err) {
                        if (err.code === 'P2002') { // Unique constraint
                            skippedDuplicates++;
                            console.log(`[EXECUTE] Race condition duplicate skipped for Staff: ${staff.id}, Month: ${monthKey}`);
                        } else {
                            invalidRecords++;
                            invalidReasons.push(`Staff ${staff.id} - DB Insert failed for month ${monthKey}: ${err.message}`);
                        }
                    }
                }
            }
        }
    }

    console.log('\n------------------------------------------------------------');
    console.log('FINAL REPORT');
    console.log('------------------------------------------------------------');
    console.log(`Staff records containing metadata : ${totalStaffFound}`);
    console.log(`Expected historical records       : ${expectedRecords}`);
    console.log(`Valid records                     : ${validRecords}`);
    console.log(`Invalid records                   : ${invalidRecords}`);
    console.log(`Duplicates skipped                : ${skippedDuplicates}`);
    console.log(`Inserted records                  : ${insertedRecords}`);
    console.log(`Tenants involved                  : ${Object.keys(tenantCounts).join(', ') || 'None'}`);
    console.log(`Units involved                    : ${Object.keys(unitCounts).join(', ') || 'None'}`);
    
    if (invalidReasons.length > 0) {
        console.log('\nInvalid Reasons:');
        invalidReasons.forEach(r => console.log(`- ${r}`));
    }
}

migrate()
    .then(() => prisma.$disconnect())
    .catch((err) => {
        console.error("Migration failed:", err);
        prisma.$disconnect();
        process.exit(1);
    });
