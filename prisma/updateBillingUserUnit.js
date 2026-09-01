import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing Billing Manager unit access...');

    const uecUnit = await prisma.unit.findUnique({ where: { code: 'UEC' } });
    if (!uecUnit) {
        console.error('UEC unit not found');
        process.exit(1);
    }

    const financeUser = await prisma.user.update({
        where: { email: 'uec.finance@demo.erp' },
        data: {
            unitId: uecUnit.id
        }
    });

    console.log(`✅ Updated ${financeUser.email} to be assigned to the UEC unit (${uecUnit.id}). Data should now be visible!`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
