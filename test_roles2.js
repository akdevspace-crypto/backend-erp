import { getRoles } from './src/modules/hr/service.js';
import { prisma } from './src/app/prisma.js';

async function run() {
  try {
    await getRoles(undefined);
    console.log("Success");
  } catch(e) {
    console.error("ERROR:");
    console.error(e.code, e.name, e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
