import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const unit = await prisma.unit.findUnique({ where: { id: '04bd72ba-2e02-4286-be33-eab675e40bf1' }});
    console.log("Unit:", unit);
}
main().finally(() => prisma.$disconnect());
