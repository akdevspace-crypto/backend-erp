import { ForecastingEngine } from '../intelligence/services/forecasting.engine';

async function runForecastTest() {
    console.log('🧪 Starting Revenue Forecast Test...');

    const tenantId = 'test-tenant-id';
    const unitId = 'test-unit-id';

    const result = await ForecastingEngine.generateRevenueForecast(tenantId, unitId);
    console.log('✅ Revenue Forecast Test Result:', result);
}

runForecastTest().catch(console.error);
