import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT to_regclass('public.Enquiry') AS enquiry, to_regclass('public.Location') AS location, to_regclass('public.ChannelIdentity') AS channel_identity"
  );
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
}
