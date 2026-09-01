import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/app/prisma.js';

const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL || 'Raghav@uec.com';
const password = process.argv[3] || process.env.SUPER_ADMIN_PASSWORD || '';

try {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      isActive: true,
      isDeleted: true,
      passwordHash: true,
      role: { select: { name: true } }
    }
  });

  const passwordMatches = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  console.log(JSON.stringify({
    found: Boolean(user),
    email: user?.email || null,
    firstName: user?.firstName || null,
    isActive: user?.isActive ?? null,
    isDeleted: user?.isDeleted ?? null,
    hasPasswordHash: Boolean(user?.passwordHash),
    role: user?.role?.name || null,
    testedPasswordFrom: process.argv[3] ? 'argument' : 'SUPER_ADMIN_PASSWORD env',
    passwordMatches
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
