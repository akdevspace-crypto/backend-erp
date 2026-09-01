import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const users = await prisma.user.findMany({
        select: { email: true, unitId: true, role: { select: { name: true } } }
    });
    users.filter(u => u.role?.name?.toLowerCase().includes('finance')).forEach(u => console.log(u.email, u.unitId, u.role.name));
}
main().finally(() => prisma.$disconnect());
