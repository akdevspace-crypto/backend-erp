require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function audit() {
    try {
        console.log("=== STAFF METADATA INVENTORY ===");
        const staff = await prisma.staff.findMany({
            select: { id: true, tenantId: true, unitId: true, metadata: true }
        });

        let staffWithDocs = 0;
        let totalDocs = 0;
        let missingRefs = 0;
        let invalidTimestamps = 0;
        const typesCount = {};

        for (const s of staff) {
            if (!s.metadata) continue;
            const docs = s.metadata.documents;
            if (docs && typeof docs === 'object') {
                const docKeys = Object.keys(docs);
                if (docKeys.length > 0) {
                    staffWithDocs++;
                    docKeys.forEach(key => {
                        const doc = docs[key];
                        totalDocs++;
                        typesCount[key] = (typesCount[key] || 0) + 1;
                        if (!doc.fileUrl && !doc.filePath) {
                            missingRefs++;
                        }
                        if (doc.uploadedAt && isNaN(new Date(doc.uploadedAt).getTime())) {
                            invalidTimestamps++;
                        }
                    });
                }
            }
        }

        console.log(`Total Staff: ${staff.length}`);
        console.log(`Staff with documents: ${staffWithDocs}`);
        console.log(`Total document records: ${totalDocs}`);
        console.log(`Document types:`, typesCount);
        console.log(`Missing file references: ${missingRefs}`);
        console.log(`Invalid timestamps: ${invalidTimestamps}`);
        
        console.log("\n=== PRISMA SCHEMA: StaffDocument ===");
        // The script doesn't read the prisma schema file, so I'll check it manually with view_file
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
audit();
