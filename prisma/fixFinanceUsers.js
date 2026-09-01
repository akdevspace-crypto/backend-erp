import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const uec = await prisma.unit.findUnique({ where: { code: 'UEC' }});
    
    await prisma.user.updateMany({
        where: { email: { contains: 'uec.finance' } },
        data: { unitId: uec.id, updatedAt: new Date() }
    });
    
    console.log(`Updated all uec.finance users to UEC unit (${uec.id})`);
}
main().finally(() => prisma.$disconnect());
