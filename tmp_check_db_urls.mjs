import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/index.js';

console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('DIRECT_URL:', process.env.DIRECT_URL);

const { PrismaClient: PC } = await import('./src/generated/prisma/index.js');
const prisma = new PC();

try {
  const result = await prisma.$queryRawUnsafe("SELECT current_database() as db, current_user as user");
  console.log(result);
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
