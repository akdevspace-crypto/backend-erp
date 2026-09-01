import { prisma } from './src/app/prisma.js';

async function check() {
    try {
        console.log("Checking DB connection...");
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log("DB Connection SUCCESS:", result);
    } catch (err) {
        console.error("DB Connection FAILED:", err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
