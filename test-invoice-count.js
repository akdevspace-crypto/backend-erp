import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const d = await prisma.invoice.findMany({});
    console.log('Total invoices in DB:', d.length);
    if(d.length > 0) console.log(d[0]);
    await prisma.$disconnect();
}
run();
