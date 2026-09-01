import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
    console.log('Migrating demo data from HQ_UNIT to UEC...');

    const hq = await prisma.unit.findUnique({ where: { code: 'HQ_UNIT' } });
    const uec = await prisma.unit.findUnique({ where: { code: 'UEC' } });

    if (!hq || !uec) {
        console.error('Units not found');
        return;
    }

    const tablesToUpdate = [
        'enquiry',
        'allocation',
        'patientDailyCost',
        'invoice',
        'accountTransaction',
        'task',
        'maintenance',
        'client',
        'patient',
        'medicationSchedule',
        'medicationLog',
        'vitalSign'
    ];

    for (const table of tablesToUpdate) {
        if (prisma[table]) {
            try {
                const res = await prisma[table].updateMany({
                    where: { unitId: hq.id },
                    data: { unitId: uec.id }
                });
                console.log(`Moved ${res.count} records in ${table}`);
            } catch (e) {
                console.log(`Skipped ${table}: ${e.message}`);
            }
        }
    }

    console.log('✅ Demo data successfully mapped to UEC unit!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
