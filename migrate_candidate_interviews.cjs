const { PrismaClient } = require('./src/generated/prisma/index.js');
const prisma = new PrismaClient();
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');

async function main() {
    console.log(`Starting interview migration... ${isDryRun ? '(DRY RUN)' : '(EXECUTE)'}`);
    
    const candidates = await prisma.candidate.findMany({
        where: {
            details: { not: null }
        }
    });
    
    let migratedCount = 0;
    
    for (const candidate of candidates) {
        if (!candidate.details || typeof candidate.details !== 'object') continue;
        
        const details = candidate.details;
        
        // Check if there is an interviewDate
        if (details.interviewDate) {
            const scheduledAt = new Date(details.interviewDate);
            
            // Check if it's a valid date
            if (isNaN(scheduledAt.getTime())) {
                console.log(`[SKIP] Candidate ${candidate.id} has invalid interviewDate: ${details.interviewDate}`);
                continue;
            }
            
            // Check if Interview already exists to ensure idempotency
            const existingInterviews = await prisma.interview.findMany({
                where: { candidateId: candidate.id }
            });
            
            if (existingInterviews.length > 0) {
                console.log(`[SKIP] Candidate ${candidate.id} already has ${existingInterviews.length} interviews.`);
                continue;
            }
            
            // Derive unitId from Candidate if available, else fallback
            const unitId = candidate.unitId || "04bd72ba-2e02-4286-be33-eab675e40bf1"; // Headquarters fallback if needed for migration
            
            let feedback = '';
            if (details.onCallNote) feedback += `On-Call Note: ${details.onCallNote}\n`;
            if (details.afterInterviewNotes) feedback += `After Interview Note: ${details.afterInterviewNotes}\n`;
            
            const interviewData = {
                candidateId: candidate.id,
                tenantId: candidate.tenantId,
                unitId: unitId,
                scheduledAt,
                interviewer: details.addressingAgent || null,
                status: 'COMPLETED',
                feedback: feedback.trim() || null
            };
            
            if (isDryRun) {
                console.log(`[DRY-RUN] Would create interview for candidate ${candidate.id}:`, interviewData);
            } else {
                await prisma.interview.create({ data: interviewData });
                console.log(`[EXECUTE] Created interview for candidate ${candidate.id}`);
            }
            
            migratedCount++;
        }
    }
    
    console.log(`Migration finished. ${migratedCount} candidates processed.`);
    await prisma.$disconnect();
}

main().catch(console.error);
