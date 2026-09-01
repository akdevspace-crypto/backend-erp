const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const cols = await prisma.$queryRaw\
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'StockIssueRequest'
    \;
    console.log(JSON.stringify(cols, null, 2));
}
main().finally(() => prisma.$disconnect());
