import { prisma } from '../src/app/prisma.js';
import { deleteTransaction } from '../src/modules/accounts/service.js';

async function test() {
    try {
        const tenant = await prisma.tenant.findFirst();
        const unit = await prisma.unit.findFirst({ where: { tenantId: tenant.id } });

        console.log('Using Tenant:', tenant.id);
        console.log('Using Unit:', unit.id);

        const tx = await prisma.accountTransaction.create({
            data: {
                refNo: 'TEST-DEL-' + Date.now(),
                type: 'EXPENSE',
                amount: -100,
                tenantId: tenant.id,
                unitId: unit.id,
                status: 'APPROVED'
            }
        });

        console.log('Created Test Transaction:', tx.id);

        const result = await deleteTransaction(tx.id, tenant.id, unit.id);
        console.log('Delete Result:', result.isDeleted);

        const check = await prisma.accountTransaction.findUnique({ where: { id: tx.id } });
        console.log('Check isDeleted:', check.isDeleted);

        process.exit(0);
    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
}

test();
