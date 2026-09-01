import { prisma } from './src/app/prisma.js';

async function createTables() {
    try {
        console.log("Creating PatientPortalAccount table...");
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "PatientPortalAccount" (
                "id" TEXT NOT NULL,
                "patientId" TEXT NOT NULL,
                "mobile" TEXT NOT NULL,
                "password" TEXT NOT NULL,
                "name" TEXT NOT NULL,
                "tenantId" TEXT NOT NULL,
                "unitId" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,
                CONSTRAINT "PatientPortalAccount_pkey" PRIMARY KEY ("id")
            );
        `);

        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "PatientPortalAccount_mobile_key" ON "PatientPortalAccount"("mobile");
        `);

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "PatientPortalAccount_patientId_idx" ON "PatientPortalAccount"("patientId");
        `);

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "PatientPortalAccount_mobile_idx" ON "PatientPortalAccount"("mobile");
        `);

        console.log("Creating PatientPortalSession table...");
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "PatientPortalSession" (
                "id" TEXT NOT NULL,
                "accountId" TEXT NOT NULL,
                "token" TEXT NOT NULL,
                "expiresAt" TIMESTAMP(3) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PatientPortalSession_pkey" PRIMARY KEY ("id")
            );
        `);

        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "PatientPortalSession_token_key" ON "PatientPortalSession"("token");
        `);

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "PatientPortalSession_token_idx" ON "PatientPortalSession"("token");
        `);

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "PatientPortalSession_accountId_idx" ON "PatientPortalSession"("accountId");
        `);

        console.log("Tables created successfully!");
    } catch (e) {
        console.error("Error creating tables:", e);
    } finally {
        await prisma.$disconnect();
    }
}

createTables();
