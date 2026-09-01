const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function test() { 
  try { 
    const cols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Enquiry' AND column_name = 'serviceRequirements'`; 
    console.log('Cols:', cols); 
  } catch (e) { 
    console.error(e); 
  } finally { 
    await prisma.$disconnect(); 
  } 
} 
test();
