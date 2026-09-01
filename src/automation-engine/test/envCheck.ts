import { PrismaClient } from "@prisma/client";
import { prisma } from '../../app/prisma.js';


async function test() {
    console.log("Environment check...");
    const counts = await (prisma as any).automationRule.count();
    console.log(`Current rules: ${counts}`);
    process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
