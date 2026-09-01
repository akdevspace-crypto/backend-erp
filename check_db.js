import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    try {
        const columns = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Enquiry'`;
        console.log(JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
