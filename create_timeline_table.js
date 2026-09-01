import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log("Connected to DB via Prisma");

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ResidentTimeline" (
        "id" TEXT NOT NULL,
        "patientId" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "details" JSONB,
        "performedBy" TEXT,
        "tenantId" TEXT NOT NULL,
        "unitId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ResidentTimeline_pkey" PRIMARY KEY ("id")
      );
    `);
    
    // Add foreign key constraint if it doesn't exist
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "ResidentTimeline" ADD CONSTRAINT "ResidentTimeline_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        `);
    } catch (e) {
        console.log("Constraint might already exist, ignoring");
    }
    
    // Add indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ResidentTimeline_tenantId_idx" ON "ResidentTimeline"("tenantId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ResidentTimeline_patientId_idx" ON "ResidentTimeline"("patientId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ResidentTimeline_category_idx" ON "ResidentTimeline"("category");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ResidentTimeline_createdAt_idx" ON "ResidentTimeline"("createdAt");`);

    console.log("Table ResidentTimeline created successfully.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
