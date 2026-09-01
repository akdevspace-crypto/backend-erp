import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'uec.finance@demo.erp' },
        include: { staff: { include: { unitAccess: true } } }
    });
    console.log("User Staff unitAccess:", user.staff?.unitAccess);
}
main().finally(() => prisma.$disconnect());
