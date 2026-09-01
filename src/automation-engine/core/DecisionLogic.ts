/**
 * 🔹 Universal Decision Context
 * Standardized data structure for AI decisions across all ERP modules
 */
export interface DecisionContext {
    entityType: string;
    entityId: string;
    module: string;
    input: any;
    computed: {
        score: number;
        label: string;
        priority: string;
        anomalies: string[];
        insights?: string;
        prediction?: {
            bestTime: string;
            bestChannel: string;
        };
    };
    meta: {
        tenantId: string;
        unitId: string;
        timestamp: Date;
    };
    actions: {
        type: string;
        payload: any;
    }[];
}

/**
 * 🔹 Module Registry
 * Defines behavior and metadata for different ERP modules
 */
export const ModuleRegistry = {
    enquiry: {
        name: "Lead Intelligence",
        signals: ["serviceType", "enquiryMode", "comment"],
        outcomes: ["HOT", "WARM", "COLD"]
    },
    accounts: {
        name: "Finance Intelligence",
        signals: ["amount", "frequency", "vendorStatus"],
        outcomes: ["LOW_RISK", "MEDIUM_RISK", "HIGH_RISK", "ANOMALY"]
    },
    hr: {
        name: "Workforce Intelligence",
        signals: ["absenteeism", "performance", "tenure"],
        outcomes: ["STABLE", "RISK", "CRITICAL_RISK"]
    },
    complaint: {
        name: "Support Intelligence",
        signals: ["sentiment", "category", "urgency"],
        outcomes: ["LOW", "MEDIUM", "HIGH", "URGENT"]
    }
};
