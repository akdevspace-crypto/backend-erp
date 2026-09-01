import 'dotenv/config';
import { prisma } from './src/app/prisma.js';

try {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('Enquiry', 'Location', 'ChannelIdentity', 'enquiry', 'location', 'channelidentity')
     ORDER BY table_name;`
  );
  console.log(JSON.stringify(tables, null, 2));
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
