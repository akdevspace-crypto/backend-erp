import 'dotenv/config';
import crypto from 'crypto';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
    console.log('Generating additional ledger data for UEC patients...');

    const uec = await prisma.unit.findUnique({ where: { code: 'UEC' } });
    const tenant = await prisma.tenant.findFirst();

    const allocations = await prisma.allocation.findMany({
        where: { unitId: uec.id },
        include: { enquiry: true }
    });

    if (allocations.length < 2) {
        console.log("No additional patients found to generate data for.");
        return;
    }

    const remainingAllocations = allocations.slice(1);
    let totalInserted = 0;

    for (const allocation of remainingAllocations) {
        let patientName = 'Unknown Patient';
        try {
            if (allocation.enquiry?.rawMessage) {
                const parsed = JSON.parse(allocation.enquiry.rawMessage);
                patientName = parsed.patientName || patientName;
            }
        } catch (e) {
            patientName = allocation.enquiry?.rawMessage || patientName;
        }
        
        console.log(`Generating data for patient: ${patientName}`);

        const dummyItems = [
            { category: 'Consumables', description: 'Adult Diapers (L)', amount: 650 },
            { category: 'Medical Supplies', description: 'Wet Wipes & Gloves', amount: 350 },
            { category: 'Pharmacy', description: 'Multivitamin Supplements', amount: 850 },
            { category: 'Special Care', description: 'Physiotherapy Session', amount: 1200 },
            { category: 'Diagnostics', description: 'Routine Blood Test', amount: 1500 }
        ];

        for (let i = 0; i < dummyItems.length; i++) {
            const item = dummyItems[i];
            
            const costDate = new Date();
            costDate.setDate(costDate.getDate() - (i % 3)); 

            await prisma.patientDailyCost.create({
                data: {
                    id: crypto.randomUUID(),
                    costNo: `COST-${patientName.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}-${i}`,
                    allocationId: allocation.id,
                    patientName: patientName,
                    costDate: costDate,
                    category: item.category,
                    description: item.description,
                    amount: item.amount,
                    status: 'DRAFT',
                    tenantId: tenant.id,
                    unitId: uec.id,
                    sourceType: 'Manual',
                    serviceType: 'Elder Care',
                    updatedAt: new Date()
                }
            });
            totalInserted++;
        }
    }

    console.log(`Successfully inserted ${totalInserted} new ledger entries for additional patients.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
