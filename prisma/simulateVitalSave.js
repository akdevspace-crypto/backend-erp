import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { saveCaregiverVitalChartService } from '../src/modules/nursing_care/service.js';

const prisma = new PrismaClient();

async function main() {
    console.log('Simulating saving an abnormal vital reading...');

    const uec = await prisma.unit.findUnique({ where: { code: 'UEC' } });
    const tenant = await prisma.tenant.findFirst();

    const allocations = await prisma.allocation.findMany({
        where: { unitId: uec.id },
        include: { enquiry: true, patient: true }
    });

    if (allocations.length === 0) return;
    const allocation = allocations[0];
    const patientId = allocation.patientId;
    
    const scope = { tenantId: tenant.id, unitId: uec.id };
    const admin = await prisma.user.findFirst({ where: { email: { contains: 'uec' } } });

    // Payload for an abnormal morning reading (Temp = 101)
    const payload = {
        patientId: patientId,
        patientName: 'Test Patient',
        month: '2026-08',
        entries: [
            {
                day: 30,
                tempMor: '101.5', // ABNORMAL (Threshold is 99)
                spo2Mor: '98',
                bpMor: '120/80',
                pulseMor: '85',
                tempEve: '',
                spo2Eve: '',
                bpEve: '',
                pulseEve: ''
            }
        ],
        status: 'DRAFT'
    };

    console.log('Invoking saveCaregiverVitalChartService with payload:', payload);
    const result = await saveCaregiverVitalChartService(payload, scope, admin.id);
    console.log('Chart saved successfully:', result);

    // Verify Core VitalSign Sync
    const latestVital = await prisma.vitalSign.findFirst({
        where: { patientId: patientId },
        orderBy: { createdAt: 'desc' }
    });
    
    console.log('Latest core VitalSign record for patient:', latestVital);
    
    // In actual app, notifyAbnormalVitals will log out 'ALERT: Abnormal vitals detected'
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
