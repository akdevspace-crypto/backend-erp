import { prisma } from './src/app/prisma.js';
import { updateCandidate } from './src/modules/hr/service.js';

async function main() {
  const candidate = await prisma.candidate.findFirst();
  console.log('Candidate before:', candidate.stage);
  
  await updateCandidate(candidate.tenantId, candidate.unitId, candidate.id, { stage: 'INTERVIEW' });
  
  const updated = await prisma.candidate.findFirst({ where: { id: candidate.id } });
  console.log('Candidate after:', updated.stage);
}

main().finally(() => prisma.$disconnect());
