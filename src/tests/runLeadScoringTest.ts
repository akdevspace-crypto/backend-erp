import { ScoringEngine } from '../intelligence/services/scoring.engine';
import { prisma } from '../app/prisma';

async function runLeadScoringTest() {
    console.log('🧪 Starting Lead Scoring Test...');

    // Create a dummy enquiry if needed
    const enquiry = await (prisma as any).enquiry.findFirst();
    if (!enquiry) {
        console.log('❌ No enquiry found to test scoring.');
        return;
    }

    const result = await ScoringEngine.calculateScore(enquiry.id, 'enquiry');
    console.log('✅ Lead Scoring Test Result:', result);
}

runLeadScoringTest().catch(console.error);
