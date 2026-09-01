import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const headquartersUnitId = '04bd72ba-2e02-4286-be33-eab675e40bf1';
    
    // Update all users who don't have a unitId or have a different unitId 
    // AND who don't have a linked staff record yet (or just update all users for testing)
    await prisma.$executeRaw`UPDATE "User" SET "unitId" = ${headquartersUnitId} WHERE "unitId" IS NULL OR "unitId" != ${headquartersUnitId}`;
    
    console.log('Successfully updated users to Headquarters unitId');
}
main().finally(() => prisma.$disconnect());
