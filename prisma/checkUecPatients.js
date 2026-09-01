import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const uec = await prisma.unit.findUnique({ where: { code: 'UEC' }});
    const allocations = await prisma.allocation.findMany({
        where: { unitId: uec.id },
        include: { enquiry: true }
    });
    console.log(`Found ${allocations.length} allocations in UEC`);
    allocations.forEach(a => {
        console.log(`- Patient: ${a.enquiry?.rawMessage || 'Unknown'} (Status: ${a.status})`);
    });
    
    // Also check how many invoices exist for UEC
    const invoices = await prisma.invoice.findMany({
        where: { unitId: uec.id }
    });
    console.log(`Found ${invoices.length} invoices in UEC`);
    
    // Check how many invoices exist across the whole DB
    const allInvoices = await prisma.invoice.findMany();
    console.log(`Found ${allInvoices.length} invoices total in DB`);
    allInvoices.forEach(i => {
        console.log(`- Invoice ${i.refNo} in Unit ${i.unitId} (Status: ${i.status})`);
    });
}
main().finally(() => prisma.$disconnect());
