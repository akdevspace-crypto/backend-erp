import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const perms = await prisma.permission.findMany();
    console.log(JSON.stringify(perms, null, 2));
}
main().finally(() => prisma.$disconnect());
