import { prisma } from '../../app/prisma.js';
import { randomUUID } from 'crypto';
import { ensurePatientBillingTables, postStockIssueToPatientLedger } from '../patient_billing/ledger.js';
import { canReadFacilityWide } from '../../shared/utils/rbac.js';

let inventoryRegisterReady = false;
let productRevenueColumnsReady = false;

export const ensureProductRevenueColumns = async () => {
    if (productRevenueColumnsReady) return;

    await (prisma as any).$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT \'Nos\'');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "defaultRevenuePrice" DOUBLE PRECISION NOT NULL DEFAULT 0');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "chargeableInCareRevenue" BOOLEAN NOT NULL DEFAULT false');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "status" BOOLEAN NOT NULL DEFAULT true');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Product_chargeableInCareRevenue_idx" ON "Product"("chargeableInCareRevenue")');

    productRevenueColumnsReady = true;
};

export const ensureInventoryRegisterTables = async () => {
    await ensureProductRevenueColumns();
    if (inventoryRegisterReady) return;

    await (prisma as any).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StockIssueRequest" (
            "id" TEXT NOT NULL,
            "productId" TEXT NOT NULL,
            "productName" TEXT NOT NULL,
            "category" TEXT NOT NULL,
            "quantity" INTEGER NOT NULL,
            "usageType" TEXT NOT NULL,
            "issuedTo" TEXT,
            "notes" TEXT,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "requestedBy" TEXT,
            "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "approvedBy" TEXT,
            "approvedAt" TIMESTAMP(3),
            "rejectedBy" TEXT,
            "rejectedAt" TIMESTAMP(3),
            "tenantId" TEXT NOT NULL,
            "unitId" TEXT NOT NULL,
            "isDeleted" BOOLEAN NOT NULL DEFAULT false,
            "deletedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "StockIssueRequest_pkey" PRIMARY KEY ("id")
        )
    `);
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockIssueRequest_tenantId_idx" ON "StockIssueRequest"("tenantId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockIssueRequest_unitId_idx" ON "StockIssueRequest"("unitId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockIssueRequest_status_idx" ON "StockIssueRequest"("status")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockIssueRequest_productId_idx" ON "StockIssueRequest"("productId")');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "StockIssueRequest" ADD COLUMN IF NOT EXISTS "allocationId" TEXT');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "StockIssueRequest" ADD COLUMN IF NOT EXISTS "patientId" TEXT');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "StockIssueRequest" ADD COLUMN IF NOT EXISTS "rate" DOUBLE PRECISION');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "StockIssueRequest" ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockIssueRequest_allocationId_idx" ON "StockIssueRequest"("allocationId")');

    await (prisma as any).$executeRawUnsafe(`
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
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_idx" ON "StockMovement"("tenantId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_unitId_idx" ON "StockMovement"("unitId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_movementType_idx" ON "StockMovement"("movementType")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_referenceId_idx" ON "StockMovement"("referenceId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt")');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "batchId" TEXT');
    await (prisma as any).$executeRawUnsafe('ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "batchId" TEXT');

    await (prisma as any).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductBatch" (
            "id" TEXT NOT NULL,
            "productId" TEXT NOT NULL,
            "batchNumber" TEXT NOT NULL,
            "expiryDate" TIMESTAMP(3) NOT NULL,
            "quantity" INTEGER NOT NULL,
            "tenantId" TEXT NOT NULL,
            "unitId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
        )
    `);
    await (prisma as any).$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ProductBatch_productId_batchNumber_tenantId_unitId_key" ON "ProductBatch"("productId", "batchNumber", "tenantId", "unitId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductBatch_tenantId_idx" ON "ProductBatch"("tenantId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductBatch_unitId_idx" ON "ProductBatch"("unitId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductBatch_expiryDate_idx" ON "ProductBatch"("expiryDate")');

    inventoryRegisterReady = true;
};

export const readNoteValue = (notes: unknown, label: string) => {
    const escapedLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedLabel}\\s*:\\s*([0-9a-fA-F-]{36})`, 'im');
    return String(notes || '').match(pattern)?.[1] || null;
};

export class InventoryService {
    async createProduct(validated: any, scope: any) {
        await ensureProductRevenueColumns();
        const isMedical = String(validated.category).toLowerCase() === 'medical';
        const isBatchTracked = validated.isBatchTracked !== undefined ? Boolean(validated.isBatchTracked) : isMedical;

        const rows = await (prisma as any).$queryRaw`
            INSERT INTO "Product" (
                "id", "name", "category", "unit", "defaultRevenuePrice", "chargeableInCareRevenue",
                "status", "isBatchTracked", "tenantId", "unitId", "createdAt", "updatedAt"
            )
            VALUES (
                ${randomUUID()}, ${validated.name}, ${validated.category}, ${validated.unit || 'Nos'},
                ${Number(validated.defaultRevenuePrice || 0)}, ${Boolean(validated.chargeableInCareRevenue)},
                ${validated.status !== false}, ${isBatchTracked}, ${scope.tenantId}, ${scope.unitId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING *
        `;
        return rows?.[0];
    }

    async getProducts(scope: any) {
        await ensureProductRevenueColumns();
        return !scope.unitId
            ? await (prisma as any).$queryRaw`
                SELECT *
                FROM "Product"
                WHERE "tenantId" = ${scope.tenantId}
                ORDER BY "createdAt" DESC
            `
            : await (prisma as any).$queryRaw`
                SELECT *
                FROM "Product"
                WHERE "tenantId" = ${scope.tenantId}
                  AND "unitId" = ${scope.unitId}
                ORDER BY "createdAt" DESC
            `;
    }

    async getStock(scope: any) {
        return await (prisma as any).stock.findMany({
            where: scope,
            include: { product: true },
            orderBy: { updatedAt: 'desc' }
        });
    }

    async getPurchases(scope: any) {
        return await (prisma as any).purchase.findMany({
            where: scope,
            include: { product: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getIssueRequests(scope: any, patientId?: string) {
        await ensureInventoryRegisterTables();
        return !scope.unitId
            ? await (prisma as any).$queryRaw`
                SELECT *
                FROM "StockIssueRequest"
                WHERE "tenantId" = ${scope.tenantId}
                  AND "isDeleted" = false
                  AND (${patientId || null}::text IS NULL OR "patientId" = ${patientId || null})
                ORDER BY "createdAt" DESC
            `
            : await (prisma as any).$queryRaw`
                SELECT *
                FROM "StockIssueRequest"
                WHERE "tenantId" = ${scope.tenantId}
                  AND "unitId" = ${scope.unitId}
                  AND "isDeleted" = false
                  AND (${patientId || null}::text IS NULL OR "patientId" = ${patientId || null})
                ORDER BY "createdAt" DESC
            `;
    }

    async createIssueRequest(validated: any, scope: any, requestedBy: string) {
        await ensureInventoryRegisterTables();
        const fallbackAllocationId = readNoteValue(validated.notes, 'Allocation');
        const allocationId = validated.allocationId || fallbackAllocationId;

        const [stock, productRows] = await Promise.all([
            (prisma as any).stock.findFirst({
                where: {
                    productId: validated.productId,
                    ...scope
                }
            }),
            (prisma as any).$queryRaw`
                SELECT "id", "name", "category", "defaultRevenuePrice"
                FROM "Product"
                WHERE "id" = ${validated.productId}
                  AND "tenantId" = ${scope.tenantId}
                  AND "unitId" = ${scope.unitId}
                LIMIT 1
            `
        ]);
        const product = productRows?.[0] || null;

        const currentQuantity = Number(stock?.quantity || 0);
        if (!product || currentQuantity <= 0) {
            throw new Error('Selected product has no available stock');
        }

        if (validated.quantity > currentQuantity) {
            throw new Error('Requested quantity is greater than available stock');
        }

        const id = randomUUID();
        const rate = Number(validated.rate || product.defaultRevenuePrice || 0);
        if (String(validated.usageType || '').toUpperCase().includes('PATIENT') && rate <= 0) {
            throw new Error('Patient care medicine requires a unit billing rate. Set Product Default Revenue Price or enter Patient Billing Rate.');
        }
        const amount = Number((validated.quantity * rate).toFixed(2));

        const createdRows = await (prisma as any).$queryRaw`
            INSERT INTO "StockIssueRequest" (
                "id", "productId", "productName", "category", "quantity", "usageType", "allocationId", "patientId", "rate", "amount", "issuedTo", "notes",
                "status", "requestedBy", "requestedAt", "tenantId", "unitId", "createdAt", "updatedAt"
            )
            VALUES (
                ${id}, ${validated.productId}, ${product.name || 'Unknown Product'}, ${product.category || '-'},
                ${validated.quantity}, ${validated.usageType}, ${allocationId || null}, ${validated.patientId || null}, ${rate}, ${amount},
                ${validated.issuedTo || null}, ${validated.notes || null},
                'PENDING', ${requestedBy}, CURRENT_TIMESTAMP, ${scope.tenantId}, ${scope.unitId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING *
        `;

        return createdRows?.[0];
    }

    async approveIssueRequest(id: string, scope: any, user: any, canReadAll: boolean) {
        await ensureInventoryRegisterTables();
        await ensurePatientBillingTables();
        
        return await (prisma as any).$transaction(async (tx: any) => {
            const rows = canReadAll
                ? await tx.$queryRaw`
                    SELECT *
                    FROM "StockIssueRequest"
                    WHERE "id" = ${id}
                      AND "tenantId" = ${scope.tenantId}
                      AND "isDeleted" = false
                    LIMIT 1
                `
                : await tx.$queryRaw`
                    SELECT *
                    FROM "StockIssueRequest"
                    WHERE "id" = ${id}
                      AND "tenantId" = ${scope.tenantId}
                      AND "unitId" = ${scope.unitId}
                      AND "isDeleted" = false
                    LIMIT 1
                `;
            const request = rows?.[0];
            if (!request) throw new Error('Stock issue request not found');
            if (request.status !== 'PENDING') throw new Error('Only pending requests can be approved');
            const operationScope = { tenantId: scope.tenantId, unitId: request.unitId };

            const liveStock = await tx.stock.findFirst({
                where: {
                    productId: request.productId,
                    ...operationScope
                }
            });
            const currentQuantity = Number(liveStock?.quantity || 0);
            if (request.quantity > currentQuantity) {
                throw new Error('Available stock is lower than requested quantity');
            }

            const isBatchTrackedRows = await tx.$queryRaw`SELECT "isBatchTracked" FROM "Product" WHERE "id" = ${request.productId} LIMIT 1`;
            const isBatchTracked = isBatchTrackedRows?.[0]?.isBatchTracked;

            if (isBatchTracked) {
                const now = new Date();
                const batches = await tx.productBatch.findMany({
                    where: {
                        productId: request.productId,
                        ...operationScope,
                        quantity: { gt: 0 },
                        expiryDate: { gt: now }
                    },
                    orderBy: { expiryDate: 'asc' }
                });

                let remainingQuantity = request.quantity;
                let totalAvailableValid = 0;
                for (const batch of batches) totalAvailableValid += batch.quantity;

                const unbatchedLegacyStock = currentQuantity - totalAvailableValid;

                if (totalAvailableValid + unbatchedLegacyStock < request.quantity) {
                    throw new Error('Insufficient valid, non-expired batch stock to fulfill the request');
                }

                for (const batch of batches) {
                    if (remainingQuantity <= 0) break;
                    const deduct = Math.min(remainingQuantity, batch.quantity);
                    
                    await tx.productBatch.update({
                        where: { id: batch.id },
                        data: { quantity: { decrement: deduct } }
                    });

                    await tx.stockMovement.create({
                        data: {
                            productId: request.productId,
                            movementType: 'ISSUE',
                            quantity: 0 - deduct,
                            batchId: batch.id,
                            referenceType: 'StockIssueRequest',
                            referenceId: request.id,
                            notes: request.notes,
                            performedBy: user?.name || user?.email || 'System',
                            ...operationScope
                        }
                    });

                    remainingQuantity -= deduct;
                }

                if (remainingQuantity > 0) {
                    await tx.stockMovement.create({
                        data: {
                            productId: request.productId,
                            movementType: 'ISSUE',
                            quantity: 0 - remainingQuantity,
                            batchId: null,
                            referenceType: 'StockIssueRequest',
                            referenceId: request.id,
                            notes: (request.notes ? request.notes + ' ' : '') + '(Legacy unbatched stock)',
                            performedBy: user?.name || user?.email || 'System',
                            ...operationScope
                        }
                    });
                    remainingQuantity = 0;
                }
            } else {
                await tx.stockMovement.create({
                    data: {
                        productId: request.productId,
                        movementType: 'ISSUE',
                        quantity: 0 - request.quantity,
                        referenceType: 'StockIssueRequest',
                        referenceId: request.id,
                        notes: request.notes,
                        performedBy: user?.name || user?.email || 'System',
                        ...operationScope
                    }
                });
            }

            await tx.stock.upsert({
                where: {
                    productId_tenantId_unitId: {
                        productId: request.productId,
                        tenantId: operationScope.tenantId,
                        unitId: operationScope.unitId
                    }
                },
                update: { quantity: { decrement: request.quantity } },
                create: {
                    productId: request.productId,
                    quantity: 0 - request.quantity,
                    ...operationScope
                }
            });

            // Keep the audit log for legacy compatibility / general auditing
            await tx.auditLog.create({
                data: {
                    userId: user?.id || null,
                    module: 'inventory',
                    action: 'POST',
                    payload: {
                        productId: request.productId,
                        quantity: 0 - request.quantity,
                        usageType: request.usageType,
                        allocationId: request.allocationId || null,
                        patientId: request.patientId || null,
                        rate: request.rate || null,
                        amount: request.amount || null,
                        issuedTo: request.issuedTo,
                        notes: request.notes,
                        stockIssueRequestId: request.id
                    },
                    ...operationScope
                }
            });

            const updatedRows = await tx.$queryRaw`
                UPDATE "StockIssueRequest"
                SET "status" = 'APPROVED',
                    "approvedBy" = ${user?.name || user?.email || 'Inventory approver'},
                    "approvedAt" = CURRENT_TIMESTAMP,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${id}
                  AND "tenantId" = ${scope.tenantId}
                RETURNING *
            `;

            const approvedRequest = updatedRows?.[0];
            const productRows = await tx.$queryRaw`
                SELECT "id", "name", "category", "defaultRevenuePrice"
                FROM "Product"
                WHERE "id" = ${approvedRequest.productId}
                  AND "tenantId" = ${operationScope.tenantId}
                LIMIT 1
            `;
            const product = productRows?.[0] || null;
            const defaultRevenuePrice = Number(product?.defaultRevenuePrice || 0);

            const noteRateMatch = String(approvedRequest.notes || '').match(/(?:Rate|Unit Cost|Cost|Medicine Rate)\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
            const noteRate = noteRateMatch ? Number(noteRateMatch[1]) : 0;
            const amountRate = Number(approvedRequest.amount || 0) > 0 && Number(approvedRequest.quantity || 0) > 0
                ? Number(approvedRequest.amount) / Number(approvedRequest.quantity)
                : 0;
            const approvedRate = Number(approvedRequest.rate || amountRate || noteRate || defaultRevenuePrice || 0);
            const savedRate = Number(approvedRequest.rate || approvedRate || 0);
            const savedAmount = Number((Number(approvedRequest.quantity || 0) * savedRate).toFixed(2));

            if (approvedRequest.rate !== savedRate || Number(approvedRequest.amount || 0) !== savedAmount) {
                const pricedRows = await tx.$queryRaw`
                    UPDATE "StockIssueRequest"
                    SET "rate" = ${savedRate},
                        "amount" = ${savedAmount},
                        "updatedAt" = CURRENT_TIMESTAMP
                    WHERE "id" = ${approvedRequest.id}
                    RETURNING *
                `;
                Object.assign(approvedRequest, pricedRows?.[0] || {});
            }

            const ledgerEntry = await postStockIssueToPatientLedger(tx, {
                ...approvedRequest,
                product
            }, user?.id || null);

            return {
                ...approvedRequest,
                patientLedgerEntry: ledgerEntry || null
            };
        });
    }

    async rejectIssueRequest(id: string, scope: any, user: any, canReadAll: boolean) {
        await ensureInventoryRegisterTables();
        const rows = canReadAll
            ? await (prisma as any).$queryRaw`
                UPDATE "StockIssueRequest"
                SET "status" = 'REJECTED',
                    "rejectedBy" = ${user?.name || user?.email || 'Inventory approver'},
                    "rejectedAt" = CURRENT_TIMESTAMP,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${id}
                  AND "tenantId" = ${scope.tenantId}
                  AND "status" = 'PENDING'
                  AND "isDeleted" = false
                RETURNING *
            `
            : await (prisma as any).$queryRaw`
                UPDATE "StockIssueRequest"
                SET "status" = 'REJECTED',
                    "rejectedBy" = ${user?.name || user?.email || 'Inventory approver'},
                    "rejectedAt" = CURRENT_TIMESTAMP,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${id}
                  AND "tenantId" = ${scope.tenantId}
                  AND "unitId" = ${scope.unitId}
                  AND "status" = 'PENDING'
                  AND "isDeleted" = false
                RETURNING *
            `;

        if (!rows?.[0]) throw new Error('Pending stock issue request not found');
        return rows[0];
    }

    async getStockMovements(scope: any) {
        // Reads directly from StockMovement
        const movements = await (prisma as any).stockMovement.findMany({
            where: scope,
            include: { product: true },
            orderBy: { createdAt: 'desc' },
            take: 300
        });
        
        return movements.map((movement: any) => ({
            id: movement.id,
            productId: movement.productId,
            product: movement.product,
            movementType: movement.movementType,
            quantity: Math.abs(movement.quantity),
            signedQuantity: movement.quantity,
            vendor: movement.referenceType === 'Purchase' ? movement.notes : null,
            usageType: null, // Left for compatibility
            notes: movement.notes,
            issuedTo: null,
            updatedBy: movement.performedBy || 'System',
            createdAt: movement.createdAt
        }));
    }

    async updateStock(productId: string, quantity: number, scope: any, user: any) {
        return await (prisma as any).$transaction(async (tx: any) => {
            const stock = await tx.stock.upsert({
                where: {
                    productId_tenantId_unitId: {
                        productId,
                        tenantId: scope.tenantId,
                        unitId: scope.unitId
                    }
                },
                update: { quantity: { increment: quantity } },
                create: {
                    productId,
                    quantity,
                    ...scope
                }
            });

            await tx.stockMovement.create({
                data: {
                    productId,
                    movementType: 'ADJUSTMENT',
                    quantity,
                    referenceType: 'Manual',
                    referenceId: null,
                    notes: 'Manual Stock Update',
                    performedBy: user?.name || user?.email || 'System',
                    ...scope
                }
            });

            return stock;
        });
    }

    async getBatches(scope: any) {
        await ensureInventoryRegisterTables();
        const batches = await (prisma as any).productBatch.findMany({
            where: {
                ...scope,
                quantity: { gt: 0 }
            },
            include: { product: true },
            orderBy: { expiryDate: 'asc' }
        });
        
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return batches.map((batch: any) => {
            const exp = new Date(batch.expiryDate);
            let status = 'Healthy';
            if (exp < now) status = 'Expired';
            else if (exp <= thirtyDays) status = 'Expiring Soon';

            return {
                ...batch,
                status
            };
        });
    }

    async createPurchase(validated: any, scope: any, user: any) {
        return await (prisma as any).$transaction(async (tx: any) => {
            const productRows = await tx.$queryRaw`SELECT "isBatchTracked" FROM "Product" WHERE "id" = ${validated.productId} LIMIT 1`;
            const product = productRows?.[0];
            if (!product) throw new Error('Product not found');

            let batchId = null;
            if (product.isBatchTracked) {
                if (!validated.batchNumber || !validated.expiryDate) {
                    throw new Error('Batch number and expiry date are required for batch-tracked products');
                }
                const expiryDate = new Date(validated.expiryDate);
                if (isNaN(expiryDate.getTime())) throw new Error('Invalid expiry date');

                const batch = await tx.productBatch.upsert({
                    where: {
                        productId_batchNumber_tenantId_unitId: {
                            productId: validated.productId,
                            batchNumber: validated.batchNumber,
                            tenantId: scope.tenantId,
                            unitId: scope.unitId
                        }
                    },
                    update: { quantity: { increment: validated.quantity } },
                    create: {
                        productId: validated.productId,
                        batchNumber: validated.batchNumber,
                        expiryDate,
                        quantity: validated.quantity,
                        ...scope
                    }
                });
                batchId = batch.id;
            }

            const purchase = await tx.purchase.create({
                data: {
                    productId: validated.productId,
                    quantity: validated.quantity,
                    vendor: validated.vendor,
                    batchId,
                    ...scope
                }
            });

            await tx.stock.upsert({
                where: {
                    productId_tenantId_unitId: {
                        productId: validated.productId,
                        tenantId: scope.tenantId,
                        unitId: scope.unitId
                    }
                },
                update: { quantity: { increment: validated.quantity } },
                create: {
                    productId: validated.productId,
                    quantity: validated.quantity,
                    ...scope
                }
            });

            await tx.stockMovement.create({
                data: {
                    productId: validated.productId,
                    movementType: 'PURCHASE',
                    quantity: validated.quantity,
                    batchId,
                    referenceType: 'Purchase',
                    referenceId: purchase.id,
                    notes: validated.vendor,
                    performedBy: user?.name || user?.email || 'System',
                    ...scope
                }
            });

            return purchase;
        });
    }

    async createKitchenRequisition(validated: { mealPrepId: string, items: { productId: string, quantity: number }[] }, scope: any, user: any) {
        await ensureInventoryRegisterTables();
        
        return await (prisma as any).$transaction(async (tx: any) => {
            const results = [];
            for (const item of validated.items) {
                const productRows = await tx.$queryRaw`
                    SELECT "id", "name", "category"
                    FROM "Product"
                    WHERE "id" = ${item.productId}
                      AND "tenantId" = ${scope.tenantId}
                      AND "unitId" = ${scope.unitId}
                    LIMIT 1
                `;
                const product = productRows?.[0];
                if (!product) throw new Error(`Product not found: ${item.productId}`);

                const liveStock = await tx.stock.findFirst({
                    where: { productId: item.productId, ...scope }
                });
                const currentQuantity = Number(liveStock?.quantity || 0);
                if (item.quantity > currentQuantity) {
                    throw new Error(`Insufficient stock for product: ${product.name}`);
                }

                const id = randomUUID();
                const amount = 0; // Kitchen prep is non-chargeable
                const notes = `MealPrep: ${validated.mealPrepId}`;

                const createdRows = await tx.$queryRaw`
                    INSERT INTO "StockIssueRequest" (
                        "id", "productId", "productName", "category", "quantity", "usageType", "patientId", "rate", "amount", "issuedTo", "notes",
                        "status", "requestedBy", "requestedAt", "approvedBy", "approvedAt", "tenantId", "unitId", "createdAt", "updatedAt"
                    )
                    VALUES (
                        ${id}, ${item.productId}, ${product.name}, ${product.category || '-'},
                        ${item.quantity}, 'KITCHEN_PREP', null, 0, ${amount}, 'Kitchen', ${notes},
                        'APPROVED', ${user?.name || user?.email || 'System'}, CURRENT_TIMESTAMP, ${user?.name || user?.email || 'System'}, CURRENT_TIMESTAMP,
                        ${scope.tenantId}, ${scope.unitId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    RETURNING *
                `;

                const request = createdRows?.[0];
                if (!request) throw new Error('Failed to create stock issue request');

                // Bypass batch logic for kitchen/ration items since they are unbatched (as per INV-2 rules)
                // If they *were* batched, we would need the full FEFO deduction here.
                // But INV-2 explicit rule: "Kitchen/Ration products remain unbatched by default".
                // Just in case, let's gracefully handle unbatched deduction:

                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        movementType: 'ISSUE',
                        quantity: 0 - item.quantity,
                        referenceType: 'StockIssueRequest',
                        referenceId: request.id,
                        notes,
                        performedBy: user?.name || user?.email || 'System',
                        ...scope
                    }
                });

                await tx.stock.update({
                    where: {
                        productId_tenantId_unitId: {
                            productId: item.productId,
                            tenantId: scope.tenantId,
                            unitId: scope.unitId
                        }
                    },
                    data: { quantity: { decrement: item.quantity } }
                });

                results.push(request);
            }
            return results;
        });
    }
}
