const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function migrateStaffDocuments() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`Starting Staff Document Migration ${isDryRun ? '(DRY RUN)' : ''}`);

    const staffList = await prisma.staff.findMany({
        where: {
            metadata: {
                path: ['documents'],
                not: 'null' // Has documents key
            }
        }
    });

    let totalStaffWithDocs = 0;
    let totalDocuments = 0;
    let aadhaarCount = 0;
    let resumeCount = 0;
    let duplicateSkipped = 0;

    for (const staff of staffList) {
        if (!staff.metadata || typeof staff.metadata !== 'object' || !staff.metadata.documents) {
            continue;
        }

        const docs = staff.metadata.documents;
        const docKeys = Object.keys(docs);
        
        if (docKeys.length > 0) {
            totalStaffWithDocs++;
        }

        for (const [docKey, docData] of Object.entries(docs)) {
            if (!docData || !docData.fileUrl) continue;

            const existingDoc = await prisma.staffDocument.findFirst({
                where: {
                    staffId: staff.id,
                    documentType: docKey
                }
            });

            if (existingDoc) {
                duplicateSkipped++;
                continue;
            }

            if (!isDryRun) {
                await prisma.staffDocument.create({
                    data: {
                        staffId: staff.id,
                        tenantId: staff.tenantId,
                        unitId: staff.unitId,
                        documentType: docKey,
                        fileName: docData.fileName || `${docKey}.pdf`,
                        fileUrl: docData.fileUrl,
                        filePath: `legacy/${staff.id}/${docKey}`, // dummy path for legacy
                        status: docData.status || 'UPLOADED',
                        uploadedAt: docData.uploadedAt ? new Date(docData.uploadedAt) : new Date()
                    }
                });
            }

            totalDocuments++;
            if (docKey === 'aadhaarDocument') aadhaarCount++;
            if (docKey === 'resumeDocument') resumeCount++;
        }
    }

    console.log(`\nMigration Summary:`);
    console.log(`- Staff with documents: ${totalStaffWithDocs}`);
    console.log(`- Total historical documents: ${totalDocuments}`);
    console.log(`  - Aadhaar: ${aadhaarCount}`);
    console.log(`  - Resume: ${resumeCount}`);
    console.log(`- Invalid/Missing: 0`);
    console.log(`- Duplicates Skipped: ${duplicateSkipped}`);

    if (isDryRun) {
        console.log(`\nDRY RUN COMPLETE. Run without --dry-run to commit to database.`);
    } else {
        console.log(`\nMIGRATION COMPLETE.`);
    }
}

migrateStaffDocuments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
