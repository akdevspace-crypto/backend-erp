const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("=== 1. TASK MODEL AUDIT ===");
    const tasksByType = await prisma.task.groupBy({ by: ['type'], _count: true });
    console.log("Tasks by type:", tasksByType);

    console.log("\n=== 2. ADL AUDIT ===");
    const adlCount = await prisma.task.count({ where: { type: 'ELDER_ADL' } });
    console.log("Total ADL Tasks:", adlCount);

    console.log("\n=== 3. INCIDENT AUDIT ===");
    const incidentTasks = await prisma.task.findMany({ where: { type: 'UEC_INCIDENT' } });
    console.log("Total Incident Tasks:", incidentTasks.length);
    let validAiUrgency = 0;
    let invalidAiUrgency = 0;
    let missingAiUrgency = 0;
    
    // Check against patients
    const patients = await prisma.patient.findMany({ select: { id: true } });
    const patientIds = new Set(patients.map(p => p.id));
    
    for (const incident of incidentTasks) {
        if (!incident.aiUrgency) {
            missingAiUrgency++;
        } else if (patientIds.has(incident.aiUrgency)) {
            validAiUrgency++;
        } else {
            invalidAiUrgency++;
        }
    }
    console.log("Valid patient-linked incidents:", validAiUrgency);
    console.log("Invalid/unmatched incidents:", invalidAiUrgency);
    console.log("Missing patient IDs in aiUrgency:", missingAiUrgency);

    console.log("\n=== 4. VITAL SIGN AUDIT ===");
    const vitalsCount = await prisma.vitalSign.count();
    const vitals = await prisma.vitalSign.findMany({ select: { patientId: true } });
    let orphanedVitals = 0;
    for (const v of vitals) {
        if (!patientIds.has(v.patientId)) orphanedVitals++;
    }
    console.log("Total VitalSigns:", vitalsCount);
    console.log("Orphaned VitalSigns:", orphanedVitals);
    console.log("Matching patientId count:", vitalsCount - orphanedVitals);

    console.log("\n=== 5. MEDICATION AUDIT ===");
    const medCount = await prisma.medication.count();
    console.log("Total Medications:", medCount);

    console.log("\n=== 6. STOCKISSUEREQUEST AUDIT ===");
    try {
        const result = await prisma.$queryRaw`SELECT count(*) as count FROM "StockIssueRequest"`;
        console.log("StockIssueRequest table exists. Record count:", Number(result[0].count));
        
        // Inspect table schema in postgres
        const schema = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'StockIssueRequest'
        `;
        console.log("StockIssueRequest Schema:", schema);
        
        // Check patientId orphans in StockIssueRequest
        const issueRequests = await prisma.$queryRaw`SELECT "patientId" FROM "StockIssueRequest" WHERE "patientId" IS NOT NULL`;
        let validIssueRequests = 0;
        let orphanedIssueRequests = 0;
        for (const req of issueRequests) {
            if (patientIds.has(req.patientId)) validIssueRequests++;
            else orphanedIssueRequests++;
        }
        console.log("StockIssueRequests with valid patientId:", validIssueRequests);
        console.log("StockIssueRequests with orphaned patientId:", orphanedIssueRequests);

    } catch (e) {
        console.log("StockIssueRequest table error:", e.message);
    }
}

run().then(() => prisma.$disconnect()).catch(console.error);
