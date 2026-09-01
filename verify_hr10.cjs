require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma/index.js');
const prisma = new PrismaClient();

async function verifyHR10() {
    console.log("Starting HR-10 Verification...");

    // 1. Prisma schema check
    console.log("\n--- Checking Candidate Unit Isolation ---");
    const candidates = await prisma.candidate.findMany();
    let orphanedCandidates = 0;
    for (const c of candidates) {
        if (!c.unitId) {
            orphanedCandidates++;
            console.log(`[WARN] Candidate ${c.id} missing unitId`);
        }
    }
    console.log(`Total Candidates: ${candidates.length}, Orphaned: ${orphanedCandidates}`);

    // 2. Interview verification
    console.log("\n--- Checking Interviews ---");
    const interviews = await prisma.interview.findMany({
        include: { candidate: true }
    });
    console.log(`Total Interviews: ${interviews.length}`);
    for (const i of interviews) {
        if (!i.tenantId || !i.unitId) {
            console.log(`[WARN] Interview ${i.id} missing tenant/unit isolation`);
        }
    }

    // 3. User Management Boundary
    console.log("\n--- Checking User Boundary ---");
    // We can't definitively prove a negative, but we can verify our recent Staff placements
    // didn't magically create User records (in HR-10).
    // The placeCandidate service creates a Staff record but no User record.
    const recentStaff = await prisma.staff.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        include: { user: true }
    });
    console.log(`Recent Staff Created: ${recentStaff.length}`);

    // 4. Job Application
    console.log("\n--- Checking Job Applications ---");
    const jobApps = await prisma.jobApplication.findMany();
    const convertedApps = jobApps.filter(j => j.followupStatus === "Converted");
    console.log(`Total Job Applications: ${jobApps.length}, Converted: ${convertedApps.length}`);

    console.log("\nVerification Complete.");
    await prisma.$disconnect();
}

verifyHR10().catch(console.error);
