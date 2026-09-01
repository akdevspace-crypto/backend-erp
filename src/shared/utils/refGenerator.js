import { prisma } from '../../app/prisma.js';

export const generateRefNumber = async (prefix, tenantId, unitId, tx = prisma) => {
    const runWithClient = async (db) => {
        const updatedCounter = await db.refCounter.upsert({
            where: { prefix_tenantId: { prefix, tenantId } },
            create: { prefix, tenantId, unitId, current: 1 },
            update: { current: { increment: 1 } }
        });

        // Pad with zeros to 6 digits, e.g., ENQ-000001
        const padded = updatedCounter.current.toString().padStart(6, '0');
        return `${prefix}-${padded}`;
    };

    // Reuse an existing transaction client when available to avoid nested transactions.
    const result = tx === prisma
        ? await prisma.$transaction(runWithClient)
        : await runWithClient(tx);

    return result;
};
