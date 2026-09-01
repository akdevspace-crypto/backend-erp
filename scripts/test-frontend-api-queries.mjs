import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";
dotenv.config();
const prisma = new PrismaClient();
const tenantId = 'fc75cbca-5a45-46e9-9905-521d708e5ebe';
const unitId = 'f7dab772-a5b3-404f-80bc-c5a4f5f03405';
async function run(label, fn) {
  try { const value = await fn(); console.log(label, 'OK', Array.isArray(value) ? value.length : value); }
  catch (error) { console.log(label, 'FAIL', error.code, error.message, error.meta || ''); }
}
await run('staff.findMany', () => prisma.staff.findMany({ where: { tenantId, unitId, isDeleted: false }, select: { id: true, empId: true, firstName: true, user: { select: { id: true, email: true, role: { select: { id: true, name: true } } } } } }));
await run('enquiry.findMany', () => prisma.enquiry.findMany({ where: { tenantId, unitId, isDeleted: false }, select: { id: true, refNo: true, client: { select: { name: true } }, followUps: { select: { id: true }, take: 1 }, allocation: { select: { id: true } } } }));
await run('automationScore.findMany', () => prisma.automationScore.findMany({ take: 1 }));
await run('superAdmin.user.findMany', () => prisma.user.findMany({ where: { tenantId, isDeleted: false }, select: { id: true, email: true, role: { select: { id: true, name: true } }, unit: { select: { id: true, name: true } }, staff: { select: { id: true } } }, take: 2 }));
await prisma.$disconnect();
