import { prisma } from '../src/app/prisma.js';

try {
  const count = await prisma.city.count();
  const latest = await prisma.city.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      state: true,
      country: true,
      status: true,
      tenantId: true,
      unitId: true,
      isDeleted: true
    }
  });

  console.log(JSON.stringify({ ok: true, count, latest }, null, 2));
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
