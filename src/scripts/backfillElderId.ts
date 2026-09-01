import { prisma } from '../app/prisma.js';
import { generateRefNumber } from '../shared/utils/refGenerator.js';

async function backfillElderIds() {
    console.log('Starting Elder ID backfill...');
    try {
        const patients = await prisma.patient.findMany({
            where: { elderId: null },
            orderBy: { createdAt: 'asc' }
        });

        console.log(`Found ${patients.length} patients needing Elder ID backfill.`);

        let successCount = 0;
        let failCount = 0;

        for (const patient of patients) {
            try {
                // Ensure we use the original registration year
                const year = patient.createdAt.getFullYear();
                const prefix = `UEC-ELD-${year}`;
                
                const elderId = await generateRefNumber(prefix, patient.tenantId, patient.unitId);

                await prisma.patient.update({
                    where: { id: patient.id },
                    data: { elderId }
                });

                successCount++;
                console.log(`Updated patient ${patient.id} with elderId ${elderId}`);
            } catch (err) {
                console.error(`Failed to update patient ${patient.id}:`, err);
                failCount++;
            }
        }

        console.log('--- Backfill Complete ---');
        console.log(`Total Success: ${successCount}`);
        console.log(`Total Failed: ${failCount}`);
    } catch (error) {
        console.error('Backfill fatal error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

backfillElderIds();
