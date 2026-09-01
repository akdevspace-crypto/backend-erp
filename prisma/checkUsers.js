import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const users = await prisma.user.findMany({ where: { email: 'uec.finance@demo.erp' }});
    console.log("Found users:", users.length);
    users.forEach(u => console.log(u.id, u.email, u.unitId, u.roleId));
}
main().finally(() => prisma.$disconnect());
