import 'dotenv/config';
import { prisma } from './src/app/prisma.js';

try {
  const enquiryCount = await prisma.enquiry.count();
  const locationCount = await prisma.location.count();
  const channelIdentityCount = await prisma.channelIdentity.count();
  console.log({ enquiryCount, locationCount, channelIdentityCount });
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
