const { PrismaClient } = require('./src/generated/prisma');
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');

if (!isDryRun && !isExecute) {
    console.error("Please specify either --dry-run or --execute");
    process.exit(1);
}

const prisma = new PrismaClient();

async function migrate() {
    try {
        console.log(`Starting Staff Salary Migration in ${isDryRun ? 'DRY RUN' : 'EXECUTE'} mode...\n`);
        
        const staffs = await prisma.staff.findMany({
            where: { metadata: { not: null } },
            include: { salary: true }
        });

        let discovered = 0;
        let valid = 0;
        let invalid = 0;
        let inserted = 0;
        let skipped = 0;

        for (const staff of staffs) {
            const metadata = staff.metadata || {};
            const payrollMeta = metadata.payroll && typeof metadata.payroll === 'object' ? metadata.payroll : {};

            const baseSalaryRaw = payrollMeta.monthlySalary ?? payrollMeta.grossPay ?? metadata.monthlySalary ?? metadata.salary;
            const fixedAllowanceRaw = payrollMeta.fixedAllowance ?? metadata.fixedAllowance;
            const fixedDeductionRaw = payrollMeta.fixedDeduction ?? metadata.fixedDeduction;

            const hasAnySalary = baseSalaryRaw !== undefined || fixedAllowanceRaw !== undefined || fixedDeductionRaw !== undefined;

            if (!hasAnySalary) continue;

            discovered++;

            const monthlySalary = Number(baseSalaryRaw || 0);
            const fixedAllowance = Number(fixedAllowanceRaw || 0);
            const fixedDeduction = Number(fixedDeductionRaw || 0);

            if (isNaN(monthlySalary) || isNaN(fixedAllowance) || isNaN(fixedDeduction)) {
                invalid++;
                console.warn(`[INVALID] Staff ${staff.firstName} (${staff.empId}): Malformed salary fields detected.`);
                continue;
            }

            valid++;

            if (staff.salary) {
                skipped++;
                console.log(`[SKIPPED] Staff ${staff.firstName} (${staff.empId}) already has a StaffSalary record.`);
                continue;
            }

            const payload = {
                staffId: staff.id,
                tenantId: staff.tenantId,
                unitId: staff.unitId || staff.tenantId, // fallback to tenantId if unitId is missing
                monthlySalary,
                fixedAllowance,
                fixedDeduction
            };

            if (isExecute) {
                await prisma.staffSalary.create({ data: payload });
                inserted++;
                console.log(`[INSERTED] Staff ${staff.firstName} (${staff.empId}): Base=${monthlySalary}, Allowance=${fixedAllowance}, Deduction=${fixedDeduction}`);
            } else {
                console.log(`[DRY-RUN - WOULD INSERT] Staff ${staff.firstName} (${staff.empId}): Base=${monthlySalary}, Allowance=${fixedAllowance}, Deduction=${fixedDeduction}`);
            }
        }

        console.log('\n--- MIGRATION SUMMARY ---');
        console.log(`Discovered configs: ${discovered}`);
        console.log(`Valid configs:      ${valid}`);
        console.log(`Invalid configs:    ${invalid}`);
        console.log(`Skipped duplicates: ${skipped}`);
        console.log(`Records inserted:   ${inserted}`);

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
