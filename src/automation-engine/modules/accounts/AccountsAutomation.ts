import { TriggerEngine } from '../../core/TriggerEngine.js';

export class AccountsAutomation {
    static async onTransactionCreated(tenantId: string, unitId: string, transactionId: string, payload: any) {
        // Tracks transaction amount
        // Example workflow outputs: Small amount auto-approve, large amount triggers Task/Notification
        return await TriggerEngine.processEvent(
            tenantId,
            unitId,
            'accounts',
            'transaction_created',
            transactionId,
            payload
        );
    }
}
