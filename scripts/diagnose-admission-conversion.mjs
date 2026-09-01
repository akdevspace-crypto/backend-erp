import { prisma } from '../src/app/prisma.js';

const enquiryId = process.argv[2];

if (!enquiryId) {
  console.error('Usage: node scripts/diagnose-admission-conversion.mjs <enquiry-id>');
  process.exit(1);
}

try {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: {
      client: true,
      admission: true
    }
  });

  if (!enquiry) {
    console.log(JSON.stringify({ found: false, enquiryId }, null, 2));
    process.exit(0);
  }

  console.log(JSON.stringify({
    found: true,
    enquiry: {
      id: enquiry.id,
      refNo: enquiry.refNo,
      status: enquiry.status,
      tenantId: enquiry.tenantId,
      unitId: enquiry.unitId,
      clientName: enquiry.client?.name,
      hasAdmission: Boolean(enquiry.admission)
    }
  }, null, 2));

  if (enquiry.admission) {
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        name: enquiry.client?.name || 'Diagnostic Patient',
        tenantId: enquiry.tenantId,
        unitId: enquiry.unitId
      }
    });

    const admission = await tx.admission.create({
      data: {
        enquiryId: enquiry.id,
        patientId: patient.id,
        tenantId: enquiry.tenantId,
        unitId: enquiry.unitId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        patient: { select: { id: true, name: true } },
        enquiry: { select: { id: true, refNo: true } }
      }
    });

    console.log(JSON.stringify({ dryRunCreateOk: true, admission }, null, 2));
    throw new Error('__ROLLBACK_DIAGNOSTIC__');
  }, {
    maxWait: 15000,
    timeout: 30000
  });
} catch (error) {
  if (error?.message === '__ROLLBACK_DIAGNOSTIC__') {
    console.log('Diagnostic transaction rolled back successfully.');
    process.exit(0);
  }

  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
