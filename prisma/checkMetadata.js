import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'uec.finance@demo.erp' },
        include: { staff: true }
    });
    console.log("Metadata:", JSON.stringify(user.staff?.metadata, null, 2));
}
main().finally(() => prisma.$disconnect());
