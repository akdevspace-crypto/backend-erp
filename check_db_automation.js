import { prisma } from './dist/app/prisma.js';

async function checkDB() {
    try {
        const scores = await prisma.automationScore.findMany({ select: { id: true, score: true, label: true, entityId: true }, take: 10, orderBy: { createdAt: 'desc' } });
        console.log("DB AutomationScores:", scores);
    } catch(err) {
        console.error("DB Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}
checkDB();
