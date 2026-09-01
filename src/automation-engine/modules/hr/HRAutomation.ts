import { TriggerEngine } from '../../core/TriggerEngine.js';

export class HRAutomation {
    static async onPerformanceReview(tenantId: string, unitId: string, staffId: string, payload: any) {
        // Identifies Attrition Risk based on rule outputs
        // Flags anomalies in staff behaviors (e.g. high absence)
        return await TriggerEngine.processEvent(
            tenantId,
            unitId,
            'hr',
            'performance_review',
            staffId,
            payload
        );
    }
}
