import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const unit = await prisma.unit.findUnique({
        where: { id: '04bd72ba-2e02-4286-be33-eab675e40bf1' },
        select: { name: true }
    });
    console.log(JSON.stringify(unit, null, 2));
}
main().finally(() => prisma.$disconnect());
