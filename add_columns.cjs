const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRaw`ALTER TABLE "Donor" ADD COLUMN "fatherOrHusbandName" TEXT, ADD COLUMN "whatsappNumber" TEXT;`;
    console.log('Columns added successfully!');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('Columns already exist.');
    } else {
      console.error(e);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
