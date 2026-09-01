import { InventoryService } from './service.js';
import { z } from 'zod';

const service = new InventoryService();

const productSchema = z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    unit: z.string().optional().default('Nos'),
    defaultRevenuePrice: z.coerce.number().min(0).optional().default(0),
    chargeableInCareRevenue: z.boolean().optional().default(false),
    status: z.boolean().optional().default(true),
    isBatchTracked: z.boolean().optional()
});

const stockUpdateSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int()
});

const purchaseSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    vendor: z.string().min(1),
    batchNumber: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable()
});

const stockIssueRequestSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    usageType: z.string().min(1),
    allocationId: z.string().uuid().optional().nullable(),
    patientId: z.string().uuid().optional().nullable(),
    rate: z.coerce.number().min(0).optional().nullable(),
    issuedTo: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
});

const kitchenRequisitionSchema = z.object({
    mealPrepId: z.string().uuid(),
    items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive()
    })).min(1)
});

const getScope = (req: any) => ({
    tenantId: req.user.tenantId,
    unitId: req.user.unitId
});

export const createProduct = async (req: any, res: any) => {
    try {
        const validated = productSchema.parse(req.body);
        const scope = getScope(req);
        const product = await service.createProduct(validated, scope);
        res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getProducts = async (req: any, res: any) => {
    try {
        const { getReadScope } = require('../../shared/utils/rbac.js');
        const scope = getReadScope(req);
        
        const { filterProductsByScope } = require('./inventoryScope');
        
        const allProducts = await service.getProducts(scope);
        const products = filterProductsByScope(allProducts, req.query.scope);
        
        res.json({ success: true, data: products });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getStock = async (req: any, res: any) => {
    try {
        const { getReadScope } = require('../../shared/utils/rbac.js');
        const scope = getReadScope(req);
        const stock = await service.getStock(scope);
        res.json({ success: true, data: stock });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPurchases = async (req: any, res: any) => {
    try {
        const { getReadScope } = require('../../shared/utils/rbac.js');
        const scope = getReadScope(req);
        const purchases = await service.getPurchases(scope);
        res.json({ success: true, data: purchases });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getIssueRequests = async (req: any, res: any) => {
    try {
        const { getReadScope } = require('../../shared/utils/rbac.js');
        const scope = getReadScope(req);
        const patientId = req.query.patientId ? String(req.query.patientId).trim() : undefined;
        const requests = await service.getIssueRequests(scope, patientId);
        res.json({ success: true, data: requests });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getBatches = async (req: any, res: any) => {
    try {
        const { getReadScope } = require('../../shared/utils/rbac.js');
        const scope = getReadScope(req);
        if (req.query.productId) {
            scope.productId = String(req.query.productId).trim();
        }
        const batches = await service.getBatches(scope);
        res.json({ success: true, data: batches });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createIssueRequest = async (req: any, res: any) => {
    try {
        const validated = stockIssueRequestSchema.parse(req.body);
        const scope = getScope(req);
        const requestedBy = req.user?.name || req.user?.email || 'Inventory requester';
        const request = await service.createIssueRequest(validated, scope, requestedBy);
        res.status(201).json({ success: true, data: request, message: 'Stock issue request saved' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const approveIssueRequest = async (req: any, res: any) => {
    try {
        const scope = getScope(req);
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ success: false, message: 'Request id is required' });

        const { canReadFacilityWide } = require('../../shared/utils/rbac.js');
        const canReadAll = canReadFacilityWide(req.user);
        
        const result = await service.approveIssueRequest(id, scope, req.user, canReadAll);
        res.json({
            success: true,
            data: result,
            message: result?.patientLedgerEntry
                ? 'Stock issue approved, stock reduced, and patient ledger updated'
                : 'Stock issue approved and stock reduced'
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const rejectIssueRequest = async (req: any, res: any) => {
    try {
        const scope = getScope(req);
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ success: false, message: 'Request id is required' });

        const { canReadFacilityWide } = require('../../shared/utils/rbac.js');
        const canReadAll = canReadFacilityWide(req.user);

        const request = await service.rejectIssueRequest(id, scope, req.user, canReadAll);
        res.json({ success: true, data: request, message: 'Stock issue request rejected' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getStockMovements = async (req: any, res: any) => {
    try {
        const { getReadScope } = require('../../shared/utils/rbac.js');
        const scope = getReadScope(req);
        const movements = await service.getStockMovements(scope);
        res.json({ success: true, data: movements });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateStock = async (req: any, res: any) => {
    try {
        const { productId, quantity } = stockUpdateSchema.parse(req.body);
        const scope = getScope(req);
        const stock = await service.updateStock(productId, quantity, scope, req.user);
        res.json({ success: true, data: stock, message: 'Stock updated successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const createPurchase = async (req: any, res: any) => {
    try {
        const validated = purchaseSchema.parse(req.body);
        const scope = getScope(req);
        const purchase = await service.createPurchase(validated, scope, req.user);
        res.status(201).json({ success: true, data: purchase, message: 'Purchase recorded and stock updated' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const createKitchenRequisition = async (req: any, res: any) => {
    try {
        const validated = kitchenRequisitionSchema.parse(req.body);
        const scope = getScope(req);
        const results = await service.createKitchenRequisition(validated, scope, req.user);
        res.status(201).json({ success: true, data: results, message: 'Kitchen requisition processed and stock updated' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};
