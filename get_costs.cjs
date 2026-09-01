const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.patientDailyCost.findMany({ select: { id: true, costDate: true, patientName: true, sourceType: true, metadata: true } }).then(res => console.log(JSON.stringify(res, null, 2))).finally(() => prisma.$disconnect());
