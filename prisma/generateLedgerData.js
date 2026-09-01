import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('Generating dummy Patient Expense Ledger data for UEC...');

    const uec = await prisma.unit.findUnique({ where: { code: 'UEC' } });
    const tenant = await prisma.tenant.findUnique({ where: { code: 'DEFAULT_TENANT' } });

    if (!uec || !tenant) {
        console.error('UEC or Tenant not found');
        return;
    }

    let allocation = await prisma.allocation.findFirst({
        where: { unitId: uec.id }
    });

    if (!allocation) {
        console.log('No allocation found in UEC. Cannot generate ledger data.');
        return;
    }

    allocation = await prisma.allocation.update({
        where: { id: allocation.id },
        data: { status: 'COMPLETED', endDate: new Date() }
    });

    const enquiry = await prisma.enquiry.findUnique({ where: { id: allocation.enquiryId } });

    const dummyCosts = [
        { cat: 'Medication', desc: 'Aspirin 500mg', amount: 150 },
        { cat: 'Consumables', desc: 'Adult Diapers', amount: 850 },
        { cat: 'Service', desc: 'Physiotherapy Session', amount: 1200 },
        { cat: 'Consumables', desc: 'Syringe & Swabs', amount: 200 }
    ];

    let createdCount = 0;
    for (const cost of dummyCosts) {
        await prisma.patientDailyCost.create({
            data: {
                id: randomUUID(),
                costNo: `COST-${Date.now()}-${createdCount}`,
                allocationId: allocation.id,
                patientName: enquiry?.rawMessage ? JSON.parse(enquiry.rawMessage).patientName : 'Demo Patient',
                serviceType: allocation.type,
                costDate: new Date(),
                category: cost.cat,
                description: cost.desc,
                quantity: 1,
                rate: cost.amount,
                amount: cost.amount,
                status: 'DRAFT',
                tenantId: tenant.id,
                unitId: uec.id,
                updatedAt: new Date()
            }
        });
        createdCount++;
    }

    console.log(`✅ Generated ${createdCount} ledger items for Allocation ${allocation.refNo} in UEC.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
