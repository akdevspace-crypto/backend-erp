import { prisma } from './src/app/prisma.js';

async function main() {
    const start = new Date('2026-08-25T09:53:40.000Z');
    const end = new Date('2026-08-25T09:53:50.000Z');
    
    const tasks = await prisma.dailyOperationTask.findMany({
        where: { createdAt: { gte: start, lte: end } }
    });
    console.log('Tasks created around the same time:', tasks.length);
    console.dir(tasks, { depth: null });
}
main().catch(console.error).finally(() => {
    console.log('Query finished, exiting...');
    process.exit(0);
});
