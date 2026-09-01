import { prisma } from './src/app/prisma.js';
async function run() {
    const users = await prisma.$queryRaw`SELECT u.email, r.name as role FROM "User" u LEFT JOIN "Role" r ON u."roleId" = r.id ORDER BY u."createdAt" DESC LIMIT 20`;
    console.log(users);
    process.exit(0);
}
run();
