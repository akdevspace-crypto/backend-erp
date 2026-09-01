import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

try {
  const count = await prisma.vendor.count();
  const latest = await prisma.vendor.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      contact: true,
      status: true,
      tenantId: true,
      unitId: true,
      isDeleted: true,
      createdAt: true,
    },
  });

  console.log(JSON.stringify({ ok: true, count, latest }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    code: error.code,
    name: error.name,
    message: error.message,
    meta: error.meta,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
