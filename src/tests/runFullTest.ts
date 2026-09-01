import { AIDecisionService } from '../modules/ai/service';
import { prisma } from '../app/prisma';

async function runFullTest() {
    console.log('🧪 Starting Full System Integration Test...');

    const enquiry = await (prisma as any).enquiry.findFirst();
    if (!enquiry) {
        console.log('❌ No enquiry found to test full flow.');
        return;
    }

    console.log(`🔄 Testing full flow for Enquiry: ${enquiry.id}`);
    const result = await AIDecisionService.processEvent({
        tenantId: enquiry.tenantId,
        unitId: enquiry.unitId,
        userId: null
    }, 'ENQUIRY_CREATED', {
        enquiryId: enquiry.id,
        entityId: enquiry.id
    });
    console.log('✅ Full System Integration Test Result:', result);
}

runFullTest().catch(console.error);
