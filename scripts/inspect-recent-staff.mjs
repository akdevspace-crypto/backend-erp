import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

try {
  const staff = await prisma.staff.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      empId: true,
      firstName: true,
      lastName: true,
      designation: true,
      department: true,
      email: true,
      phone: true,
      status: true,
      userId: true,
      tenantId: true,
      unitId: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: { select: { name: true } },
          isActive: true
        }
      }
    }
  });

  console.log(JSON.stringify(staff, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
