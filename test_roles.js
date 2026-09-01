import { getRoles } from './src/modules/hr/service.js';
import { prisma } from './src/app/prisma.js';

async function run() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("No user found");
    console.log("Testing with tenant:", user.tenantId);
    await getRoles(user.tenantId);
    console.log("Success");
  } catch(e) {
    console.error("ERROR:");
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
