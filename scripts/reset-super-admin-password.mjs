import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/app/prisma.js';

const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL;
const password = process.argv[3] || process.env.SUPER_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Usage: node scripts/reset-super-admin-password.mjs <email> <password>');
  process.exit(1);
}

try {
  const existing = await prisma.user.findFirst({
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
      isDeleted: true
    }
  });

  if (!existing) {
    throw new Error(`No user found for ${email}`);
  }

  if (existing.isDeleted) {
    throw new Error(`User ${existing.email} is deleted. Refusing to reset password.`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      passwordHash,
      isActive: true
    }
  });

  const updated = await prisma.user.findUnique({
    where: { id: existing.id },
    select: {
      email: true,
      firstName: true,
      isActive: true,
      passwordHash: true
    }
  });

  console.log(JSON.stringify({
    ok: true,
    email: updated.email,
    firstName: updated.firstName,
    isActive: updated.isActive,
    passwordMatches: await bcrypt.compare(password, updated.passwordHash)
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
