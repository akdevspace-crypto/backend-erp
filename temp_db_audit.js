const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('Tasks by type:', await prisma.task.groupBy({ by: ['type'], _count: true }));
    console.log('Vitals count:', await prisma.vitalSign.count());
    
    // Check orphaned vitals manually to avoid raw SQL escaping issues
    const vitals = await prisma.vitalSign.findMany({ select: { patientId: true } });
    const patients = await prisma.patient.findMany({ select: { id: true } });
    const patientIds = new Set(patients.map(p => p.id));
    
    let orphanedVitals = 0;
    for (const v of vitals) {
        if (!patientIds.has(v.patientId)) orphanedVitals++;
    }
    
    console.log('Orphaned vitals:', orphanedVitals);

    // Also check for Medicine Issue/Request models since we need to know if they exist
    // They are not in schema.prisma, so we might need to check if they are stored in Task or somewhere else.
    console.log('Tasks that look like Medicine Request/Issue:');
    const medTasks = await prisma.task.findMany({
        where: {
            OR: [
                { type: 'MEDICINE_ISSUE' },
                { type: 'MEDICINE_REQUEST' },
                { title: { contains: 'Medicine' } }
            ]
        },
        select: { id: true, type: true, title: true }
    });
    console.log(medTasks);
}

run().then(() => prisma.()).catch(console.error);
