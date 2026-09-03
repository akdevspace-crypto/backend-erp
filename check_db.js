import { prisma } from './src/app/prisma.js';

async function main() {
    const latestPass = await prisma.visitorPass.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
            approvedByUser: true
        }
    });
    console.log(JSON.stringify(latestPass, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
