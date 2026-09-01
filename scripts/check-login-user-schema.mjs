import 'dotenv/config';
import { prisma } from '../src/app/prisma.js';

const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL || 'Raghav@uec.com';

try {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive'
      }
    },
    include: {
      role: true,
      tenant: true,
      unit: true,
      staff: {
        select: {
          id: true,
          empId: true
        }
      }
    }
  });

  console.log(JSON.stringify({
    ok: true,
    found: Boolean(user),
    email: user?.email,
    firstName: user?.firstName,
    role: user?.role?.name,
    tenant: user?.tenant?.code,
    unit: user?.unit?.code
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
