import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'uec.finance@demo.erp' }});
    console.log("User unitId:", user.unitId);
}
main().finally(() => prisma.$disconnect());
