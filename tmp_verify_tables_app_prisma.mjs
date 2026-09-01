import 'dotenv/config';
import { prisma } from './src/app/prisma.js';

try {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT to_regclass('public.Enquiry')::text AS enquiry, to_regclass('public.Location')::text AS location, to_regclass('public.ChannelIdentity')::text AS channel_identity"
  );
  console.log(JSON.stringify(rows, null, 2));
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
