import { createInvoice, listInvoices, createIncome, createExpense, getCashbox, approveTransaction, updateTransaction, deleteTransaction, recordInvoicePayment, reconcileMissingServiceInvoices } from './service.js';
import { success } from '../../shared/utils/response.js';
import { RevenueForecastService } from '../../intelligence/services/revenue-forecast.service.js';
import { invoiceSchema, transactionSchema, approvalSchema, invoicePaymentSchema } from './schema.js';
import { emitEvent, EVENTS } from '../event/service.js';

const canReadAllUnitFinance = (user) => {
    const normalizedRole = String(user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
    return ['admin', 'super admin', 'superadmin', 'finance manager'].includes(normalizedRole);
};

export const handleCreateInvoice = async (req, res, next) => {
    try {
        const data = invoiceSchema.parse(req.body);
        const result = await createInvoice(req.tenantId, req.unitId, data);
        emitEvent(EVENTS.INVOICE_CREATED, { invoice: result });
        return success(res, result, { message: 'Invoice created successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleListInvoices = async (req, res, next) => {
    try {
        const start = Date.now();
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const effectiveUnitId = requestedAllUnits && canReadAllUnitFinance(req.user) ? 'ALL' : req.unitId;
        
        console.log(`[InvoiceList] Start request. unitId=${effectiveUnitId}, search=${req.query?.search}`);
        
        const recStart = Date.now();
        await reconcileMissingServiceInvoices(req.tenantId, effectiveUnitId);
        const recEnd = Date.now();
        console.log(`[InvoiceList] Reconciliation took ${recEnd - recStart}ms`);
        
        const qStart = Date.now();
        const invoices = await listInvoices(
            req.tenantId,
            effectiveUnitId,
            {
                search: req.query?.search,
                limit: req.query?.limit
            }
        );
        const qEnd = Date.now();
        console.log(`[InvoiceList] Invoice query took ${qEnd - qStart}ms`);
        
        console.log(`[InvoiceList] Total time: ${Date.now() - start}ms`);
        return success(res, invoices);
    } catch (error) {
        console.error(`[InvoiceList] Error:`, error);
        next(error);
    }
};

export const handleGetFinanceForecast = async (req, res, next) => {
    try {
        const forecast = await RevenueForecastService.getLatestForecast(req.tenantId, req.unitId);
        return success(res, forecast);
    } catch (error) {
        next(error);
    }
};

export const handleCreateIncome = async (req, res, next) => {
    try {
        const data = transactionSchema.parse(req.body);
        const result = await createIncome(req.tenantId, req.unitId, req.user.id, data);
        return success(res, result, { message: 'Income recorded and pending approval' });
    } catch (error) {
        next(error);
    }
};

export const handleRecordInvoicePayment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = invoicePaymentSchema.parse(req.body);
        const result = await recordInvoicePayment(req.tenantId, req.unitId, req.user.id, id, data);
        return success(res, result, { message: 'Payment collected and receipt generated' });
    } catch (error) {
        next(error);
    }
};

export const handleCreateExpense = async (req, res, next) => {
    try {
        const data = transactionSchema.parse(req.body);
        const result = await createExpense(req.tenantId, req.unitId, req.user.id, data);
        return success(res, result, { message: 'Expense recorded and pending approval' });
    } catch (error) {
        next(error);
    }
};

export const handleGetCashbox = async (req, res, next) => {
    try {
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const results = await getCashbox(req.tenantId, requestedAllUnits && canReadAllUnitFinance(req.user) ? 'ALL' : req.unitId);
        return success(res, results);
    } catch (error) {
        next(error);
    }
};

export const handleApproveTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, comments } = approvalSchema.parse(req.body);
        const result = await approveTransaction(id, req.user.id, status, comments);
        return success(res, result, { message: `Transaction has been ${status}` });
    } catch (error) {
        next(error);
    }
};

export const handleUpdateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const effectiveUnitId = canReadAllUnitFinance(req.user) ? 'ALL' : req.unitId;
        const result = await updateTransaction(id, req.tenantId, effectiveUnitId, req.body);
        return success(res, result, { message: 'Transaction updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const effectiveUnitId = canReadAllUnitFinance(req.user) ? 'ALL' : req.unitId;
        const result = await deleteTransaction(id, req.tenantId, effectiveUnitId);
        return success(res, result, { message: 'Transaction deleted successfully' });
    } catch (error) {
        next(error);
    }
};
