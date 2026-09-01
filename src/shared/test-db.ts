import { PrismaClient } from "@prisma/client";
import { prisma } from '../app/prisma.js';




async function testConn() {
    console.log("⏳ Testing Prisma connection...");
    try {
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log("✅ Connection Successful:", result);
    } catch (err) {
        console.error("❌ Connection Failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

testConn();
