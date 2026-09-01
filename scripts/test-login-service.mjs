import 'dotenv/config';
import { loginUser } from '../src/modules/auth/service.js';
import { prisma } from '../src/app/prisma.js';

const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL;
const password = process.argv[3] || process.env.SUPER_ADMIN_PASSWORD;

try {
  const result = await loginUser({ email, password });
  console.log(JSON.stringify({
    ok: true,
    email: result.user.email,
    name: result.user.name,
    role: result.user.role?.name || null,
    permissions: result.user.permissions?.slice(0, 5) || [],
    accessTokenIssued: Boolean(result.accessToken)
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
