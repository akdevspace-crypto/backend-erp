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
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      empId: true,
      firstName: true,
      lastName: true,
      designation: true,
      department: true,
      email: true,
      userId: true,
      tenantId: true,
      unitId: true,
      createdAt: true
    }
  });

  const units = await prisma.unit.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      shortName: true,
      tenantId: true
    }
  });

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const grouped = staff.reduce((acc, member) => {
    const unit = unitById.get(member.unitId);
    const key = member.unitId || 'NO_UNIT';
    if (!acc[key]) {
      acc[key] = {
        unitId: member.unitId,
        unitName: unit?.name || null,
        unitCode: unit?.code || null,
        shortName: unit?.shortName || null,
        count: 0,
        latest: []
      };
    }
    acc[key].count += 1;
    if (acc[key].latest.length < 5) {
      acc[key].latest.push({
        empId: member.empId,
        name: [member.firstName, member.lastName].filter(Boolean).join(' '),
        designation: member.designation,
        email: member.email,
        hasLogin: Boolean(member.userId),
        createdAt: member.createdAt
      });
    }
    return acc;
  }, {});

  console.log(JSON.stringify(Object.values(grouped), null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
