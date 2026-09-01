const { PrismaClient } = require('./src/generated/prisma/index.js');
const prisma = new PrismaClient();
const crypto = require('crypto');

const isExecute = process.argv.includes('--execute');

if (!isExecute) {
    console.log('--- DRY RUN MODE ---');
    console.log('Run with --execute to perform actual migration.');
} else {
    console.log('--- EXECUTE MODE ---');
}

const getMovementType = (payload) => {
    if (payload?.vendor) return 'PURCHASE';
    return Number(payload?.quantity || 0) < 0 ? 'ISSUE' : 'ADJUSTMENT';
};

async function migratePurchases() {
    console.log('\\n--- MIGRATING PURCHASES ---');
    const purchases = await prisma.purchase.findMany({
        orderBy: { createdAt: 'asc' }
    });
    console.log(`Found ${purchases.length} purchases.`);

    let migrated = 0;
    let skipped = 0;

    for (const purchase of purchases) {
        const existing = await prisma.stockMovement.findFirst({
            where: { referenceId: purchase.id, referenceType: 'Purchase' }
        });

        if (existing) {
            skipped++;
            continue;
        }

        if (isExecute) {
            await prisma.stockMovement.create({
                data: {
                    productId: purchase.productId,
                    movementType: 'PURCHASE',
                    quantity: purchase.quantity,
                    referenceType: 'Purchase',
                    referenceId: purchase.id,
                    notes: purchase.vendor || 'Historical Purchase',
                    performedBy: 'System Migration',
                    tenantId: purchase.tenantId,
                    unitId: purchase.unitId,
                    createdAt: purchase.createdAt,
                    updatedAt: purchase.createdAt
                }
            });
        }
        migrated++;
    }

    console.log(`Migrated: ${migrated}, Skipped (already exists): ${skipped}`);
}

async function migrateAuditLogs() {
    console.log('\\n--- MIGRATING AUDIT LOGS ---');
    const auditLogs = await prisma.auditLog.findMany({
        where: {
            module: 'inventory',
            action: 'POST',
            isDeleted: false
        },
        include: { user: true },
        orderBy: { createdAt: 'asc' }
    });
    console.log(`Found ${auditLogs.length} inventory POST audit logs.`);

    let migrated = 0;
    let skippedExists = 0;
    let skippedInvalid = 0;

    for (const log of auditLogs) {
        const payload = log.payload || {};
        if (typeof payload !== 'object' || !payload.productId || typeof payload.quantity === 'undefined' || payload.vendor) {
            // Either invalid or a purchase (which is handled separately though auditLogs shouldn't have purchases mapped here historically unless mixed up)
            skippedInvalid++;
            continue;
        }

        const existing = await prisma.stockMovement.findFirst({
            where: { referenceId: log.id, referenceType: 'AuditLog' }
        });

        if (existing) {
            skippedExists++;
            continue;
        }

        const movementType = getMovementType(payload);
        const performedBy = [log.user?.firstName, log.user?.lastName].filter(Boolean).join(' ').trim() || log.user?.email || 'System Migration';

        if (isExecute) {
            await prisma.stockMovement.create({
                data: {
                    productId: payload.productId,
                    movementType: movementType,
                    quantity: payload.quantity, // usually negative for issues
                    referenceType: 'AuditLog',
                    referenceId: log.id,
                    notes: payload.notes || payload.usageType || null,
                    performedBy: performedBy,
                    tenantId: log.tenantId,
                    unitId: log.unitId,
                    createdAt: log.createdAt,
                    updatedAt: log.createdAt
                }
            });
        }
        migrated++;
    }

    console.log(`Migrated: ${migrated}, Skipped (already exists): ${skippedExists}, Skipped (invalid payload): ${skippedInvalid}`);
}

async function main() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "StockMovement" (
                "id" TEXT NOT NULL,
                "productId" TEXT NOT NULL,
                "movementType" TEXT NOT NULL,
                "quantity" INTEGER NOT NULL,
                "balanceAfter" INTEGER,
                "referenceType" TEXT,
                "referenceId" TEXT,
                "notes" TEXT,
                "performedBy" TEXT,
                "tenantId" TEXT NOT NULL,
                "unitId" TEXT NOT NULL,
                "isDeleted" BOOLEAN NOT NULL DEFAULT false,
                "deletedAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
            )
        `);
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_idx" ON "StockMovement"("tenantId")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_unitId_idx" ON "StockMovement"("unitId")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_movementType_idx" ON "StockMovement"("movementType")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_referenceId_idx" ON "StockMovement"("referenceId")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt")');

        await migratePurchases();
        await migrateAuditLogs();

        const totalMovements = await prisma.stockMovement.count();
        console.log(`\\nFinal StockMovement Count: ${totalMovements}`);

        if (!isExecute) {
            console.log('\\nDRY RUN completed successfully. No data was changed.');
        } else {
            console.log('\\nMIGRATION completed successfully.');
        }
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
