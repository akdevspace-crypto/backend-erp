export type LeadGroup = "HOT" | "WARM" | "COLD";
export type Trend = "UP" | "DOWN" | "STABLE";

export interface ForecastBreakdown {
    hot: number;
    warm: number;
    cold: number;
}

export interface RevenueForecastResult {
    predictedRevenue: number;
    trend: Trend;
    confidence: number;
    breakdown: ForecastBreakdown;
}

export interface GroupStats {
    total: number;
    converted: number;
    conversionRate: number;
}

export interface EngineConfig {
    defaultAvgRevenue: number;
    defaultRates: Record<LeadGroup, number>;
}
