import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
    const txns = await prisma.accountTransaction.findMany();
    console.log('AccountTxn unitIds:', [...new Set(txns.map(x=>x.unitId))]);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
