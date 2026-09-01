import { PrismaClient } from '@prisma/client';
import { generateRefNumber } from './src/shared/utils/refGenerator.js';

const prisma = new PrismaClient();

async function run() {
  const tenantId = 'TENANT-123';
  const unitId = 'UNIT-123';
  const year = new Date().getFullYear();
  const prefix = `UEC-INV-${year}`;

  console.log("Simulating Manual Billing Invoice...");
  const refNo1 = await generateRefNumber(prefix, tenantId, unitId);
  console.log("Manual Generated: ", refNo1);

  console.log("Simulating Automated Billing Invoice...");
  const refNo2 = await generateRefNumber(prefix, tenantId, unitId);
  console.log("Automated Generated: ", refNo2);

  console.log("Simulating concurrent invoice generation...");
  const p1 = generateRefNumber(prefix, tenantId, unitId);
  const p2 = generateRefNumber(prefix, tenantId, unitId);
  const [refNo3, refNo4] = await Promise.all([p1, p2]);
  console.log("Concurrent Generated: ", refNo3, refNo4);

  console.log("Simulating Next Year (2027)...");
  const prefixNext = `UEC-INV-2027`;
  const refNo5 = await generateRefNumber(prefixNext, tenantId, unitId);
  console.log("2027 Generated: ", refNo5);
}

run().catch(console.error).finally(() => prisma.$disconnect());
