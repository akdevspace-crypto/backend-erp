import { prisma } from './src/app/prisma.js';
import { updateCandidate, createInterview } from './src/modules/hr/service.js';

async function main() {
  const candidate = await prisma.candidate.findFirst({ where: { stage: 'LEAD' } });
  if (!candidate) return console.log('No LEAD candidate found');

  try {
    const data = {
      stage: 'INTERVIEW',
      details: {
        ...(candidate.details || {}),
        interviewDate: '2025-10-10T10:00:00'
      }
    };
    
    await updateCandidate(candidate.tenantId, candidate.unitId, candidate.id, data);
    console.log('Candidate updated successfully to INTERVIEW');
    
    await createInterview(candidate.tenantId, candidate.unitId, candidate.id, {
      scheduledAt: '2025-10-10T10:00:00',
      status: 'SCHEDULED'
    });
    console.log('Interview created successfully');
    
  } catch(e) {
    console.error('Error during test:', e);
  }
}

main().finally(() => prisma.$disconnect());
