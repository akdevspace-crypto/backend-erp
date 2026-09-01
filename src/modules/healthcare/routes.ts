import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../app/prisma.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { getReadScope } from '../../shared/utils/rbac.js';
import { sendNotification } from '../notification/service.js';
import { z } from 'zod';
import { ensurePatientBillingTables, postStockIssueToPatientLedger } from '../patient_billing/ledger.js';
import { generateRefNumber } from '../../shared/utils/refGenerator.js';

const router = Router();

const patientSchema = z.object({
    name: z.string().min(1)
});

const medicationSchema = z.object({
    patientId: z.string().uuid(),
    name: z.string().min(1),
    dosage: z.string().min(1)
});

const medicationScheduleSchema = z.object({
    medicineIssueId: z.string().min(1),
    medicineName: z.string().min(1),
    patientName: z.string().min(1),
    dose: z.string().min(1),
    frequency: z.string().min(1),
    times: z.array(z.string().min(1)).min(1),
    startDate: z.string().min(1),
    notes: z.string().optional().default('')
});

const administerDoseSchema = z.object({
    slot: z.string().min(1),
    remarks: z.string().optional().default('')
});

const nutritionSchema = z.object({
    patientId: z.string().uuid(),
    calories: z.number().int().positive(),
    dietPlan: z.string().min(1)
});

const adlSchema = z.object({
    patientId: z.string().uuid(),
    mobility: z.string().min(1),
    hygiene: z.string().min(1),
    feeding: z.string().min(1),
    notes: z.string().optional().default('')
});

const adlStatusSchema = z.object({
    status: z.enum(['RECORDED', 'NEEDS_SUPPORT', 'COMPLETED'])
});

const getScope = (req: any) => ({
    tenantId: req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId
});



const caregiverVitalEntrySchema = z.object({
    day: z.number().int().min(1).max(31),
    tempMor: z.string().optional().default(''),
    tempEve: z.string().optional().default(''),
    bpMor: z.string().optional().default(''),
    bpEve: z.string().optional().default(''),
    pulseMor: z.string().optional().default(''),
    pulseEve: z.string().optional().default(''),
    spo2Mor: z.string().optional().default(''),
    spo2Eve: z.string().optional().default(''),
    rrMor: z.string().optional().default(''),
    rrEve: z.string().optional().default(''),
    glucoseBf: z.string().optional().default(''),
    glucoseAf: z.string().optional().default(''),
    weight: z.string().optional().default(''),
    intakeBf: z.string().optional().default(''),
    intakeLunch: z.string().optional().default(''),
    intakeDinner: z.string().optional().default(''),
    urine: z.string().optional().default(''),
    stool: z.string().optional().default(''),
    sign: z.string().optional().default(''),
    remarks: z.string().optional().default('')
});

const caregiverVitalChartSchema = z.object({
    patientId: z.string().uuid(),
    admissionId: z.string().uuid().optional(),
    enquiryId: z.string().uuid().optional(),
    allocationId: z.string().uuid().optional(),
    patientName: z.string().optional().default(''),
    age: z.string().optional().default(''),
    sex: z.string().optional().default(''),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
    entries: z.array(caregiverVitalEntrySchema).default([]),
    signatures: z.object({
        doctor: z.string().optional().default(''),
        nurse: z.string().optional().default(''),
        attender: z.string().optional().default(''),
        manager: z.string().optional().default('')
    }).optional().default({ doctor: '', nurse: '', attender: '', manager: '' }),
    status: z.string().optional().default('DRAFT')
});

let caregiverVitalChartReady = false;

const ensureCaregiverVitalChartTable = async () => {
    if (caregiverVitalChartReady) return;

    await (prisma as any).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CaregiverVitalChart" (
            "id" TEXT NOT NULL,
            "patientId" TEXT NOT NULL,
            "patientName" TEXT NOT NULL,
            "age" TEXT,
            "sex" TEXT,
            "month" TEXT NOT NULL,
            "entries" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "signatures" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "status" TEXT NOT NULL DEFAULT 'DRAFT',
            "tenantId" TEXT NOT NULL,
            "unitId" TEXT NOT NULL,
            "createdBy" TEXT,
            "isDeleted" BOOLEAN NOT NULL DEFAULT false,
            "deletedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CaregiverVitalChart_pkey" PRIMARY KEY ("id")
        )
    `);
    await (prisma as any).$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "CaregiverVitalChart_patient_month_key" ON "CaregiverVitalChart"("patientId", "month", "tenantId", "unitId") WHERE "isDeleted" = false');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CaregiverVitalChart_tenant_unit_idx" ON "CaregiverVitalChart"("tenantId", "unitId")');
    await (prisma as any).$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CaregiverVitalChart_month_idx" ON "CaregiverVitalChart"("month")');

    caregiverVitalChartReady = true;
};

const toCaregiverVitalChart = (row: any) => ({
    ...row,
    entries: Array.isArray(row.entries) ? row.entries : [],
    signatures: row.signatures && typeof row.signatures === 'object' && !Array.isArray(row.signatures) ? row.signatures : {}
});

const debugCaregiverVitalChart = (message: string, payload?: Record<string, unknown>) => {
    if (process.env.DEBUG_VITAL_CHARTS !== 'true') return;
    console.log(`[CAREGIVER_VITAL_CHART] ${message}`, payload || {});
};

const resolveCaregiverVitalChartPatient = async (
    validated: z.infer<typeof caregiverVitalChartSchema>,
    scope: { tenantId: string; unitId: string }
) => {
    const patient = await (prisma as any).patient.findFirst({
        where: {
            id: validated.patientId,
            tenantId: scope.tenantId
        },
        select: { id: true, name: true, tenantId: true, unitId: true }
    });

    debugCaregiverVitalChart('patient master lookup', {
        patientId: validated.patientId,
        tenantId: scope.tenantId,
        unitId: scope.unitId,
        found: Boolean(patient),
        patientUnitId: patient?.unitId || null
    });

    if (!patient) return null;
    if (patient.unitId === scope.unitId) return patient;

    const admission = await (prisma as any).admission.findFirst({
        where: {
            tenantId: scope.tenantId,
            patientId: patient.id,
            OR: [
                { unitId: scope.unitId },
                ...(validated.admissionId ? [{ id: validated.admissionId }] : []),
                ...(validated.enquiryId ? [{ enquiryId: validated.enquiryId }] : [])
            ]
        },
        select: {
            id: true,
            unitId: true,
            patient: {
                select: { id: true, name: true, tenantId: true, unitId: true }
            }
        }
    });

    debugCaregiverVitalChart('admission lookup', {
        admissionId: validated.admissionId || null,
        enquiryId: validated.enquiryId || null,
        found: Boolean(admission),
        admissionUnitId: admission?.unitId || null
    });

    if (admission?.patient) return admission.patient;

    const allocation = await (prisma as any).allocation.findFirst({
        where: {
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            type: 'IN_HOUSE',
            isDeleted: false,
            ...(validated.allocationId ? { id: validated.allocationId } : {}),
            ...(validated.enquiryId ? { enquiryId: validated.enquiryId } : {}),
            enquiry: {
                is: {
                    admission: {
                        is: {
                            patientId: patient.id
                        }
                    }
                }
            }
        },
        select: {
            id: true,
            enquiryId: true,
            enquiry: {
                select: {
                    admission: {
                        select: {
                            patient: {
                                select: { id: true, name: true, tenantId: true, unitId: true }
                            }
                        }
                    }
                }
            }
        }
    });

    debugCaregiverVitalChart('in-house allocation lookup', {
        allocationId: validated.allocationId || null,
        enquiryId: validated.enquiryId || null,
        found: Boolean(allocation)
    });

    return allocation?.enquiry?.admission?.patient || null;
};

const medicationScheduleModule = 'HEALTHCARE_MEDICATION';
const medicationScheduleAction = 'MEDICATION_SCHEDULE';
const adlModule = 'HEALTHCARE_ADL';
const adlAction = 'DAILY_LIVING';

const toMedicationSchedule = (row: any) => {
    const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
    return {
        id: row.id,
        ...payload,
        times: Array.isArray(payload.times) ? payload.times : [],
        administeredSlots: Array.isArray(payload.administeredSlots) ? payload.administeredSlots : [],
        administeredHistory: Array.isArray(payload.administeredHistory) ? payload.administeredHistory : [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

const toAdlRecord = (row: any, patientMap = new Map<string, any>()) => {
    const patientId = String(row.patientId || '');
    return {
        id: row.id,
        patientId,
        patient: patientMap.get(patientId) || null,
        mobility: row.mobility || '',
        hygiene: row.hygiene || '',
        feeding: row.feeding || '',
        notes: row.notes || '',
        status: row.status || '',
        recordedBy: row.recordedById || '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

const readNoteValue = (notes: unknown, label: string) => {
    const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.+)$`, 'im');
    return String(notes || '').match(pattern)?.[1]?.trim() || '';
};

const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '');

const resolveDoseNotificationUserIds = async (payload: any, scope: { tenantId: string; unitId: string }) => {
    const userIds = new Set<string>();
    const medicineIssueId = String(payload?.medicineIssueId || '').trim();
    if (!medicineIssueId) return [];

    const issueRows = await (prisma as any).$queryRaw`
        SELECT "id", "notes", "issuedTo", "tenantId", "unitId"
        FROM "StockIssueRequest"
        WHERE "id" = ${medicineIssueId}
          AND "tenantId" = ${scope.tenantId}
          AND "unitId" = ${scope.unitId}
          AND "isDeleted" = false
        LIMIT 1
    `;
    const issue = issueRows?.[0];
    const allocationId = readNoteValue(issue?.notes || payload?.notes, 'Allocation');

    if (!allocationId) return [];

    const allocation = await (prisma as any).allocation.findFirst({
        where: {
            id: allocationId,
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            isDeleted: false
        },
        select: {
            staff: {
                select: {
                    userId: true
                }
            },
            enquiry: {
                select: {
                    client: {
                        select: {
                            email: true,
                            mobile: true
                        }
                    }
                }
            }
        }
    });

    if (allocation?.staff?.userId) userIds.add(allocation.staff.userId);

    const client = allocation?.enquiry?.client;
    const OR: any[] = [];
    const clientEmail = String(client?.email || '').trim();
    const clientMobile = normalizePhone(client?.mobile);
    if (clientEmail) OR.push({ email: { equals: clientEmail, mode: 'insensitive' } });
    if (clientMobile) OR.push({ mobile: { contains: clientMobile } });

    if (OR.length) {
        const familyUsers = await (prisma as any).user.findMany({
            where: {
                tenantId: scope.tenantId,
                isDeleted: false,
                isActive: true,
                OR,
                role: {
                    name: {
                        in: ['Family Member', 'Client Family Member', 'Client']
                    }
                }
            },
            select: { id: true }
        });
        familyUsers.forEach((user: any) => userIds.add(user.id));
    }

    return Array.from(userIds);
};

const notifyDoseAdministration = async (payload: any, scope: { tenantId: string; unitId: string }) => {
    try {
        const userIds = await resolveDoseNotificationUserIds(payload, scope);
        if (!userIds.length) return;

        const latestHistory = Array.isArray(payload.administeredHistory)
            ? payload.administeredHistory[payload.administeredHistory.length - 1]
            : null;
        const slot = latestHistory?.slot || 'Scheduled';
        const administeredBy = latestHistory?.administeredBy || 'Care staff';
        const medicineName = payload?.medicineName || 'Medicine';
        const patientName = payload?.patientName || 'patient';
        const message = `${medicineName} ${slot} dose was given to ${patientName} by ${administeredBy}.`;

        await Promise.allSettled(userIds.map((userId) => sendNotification({
            userId,
            message,
            type: 'MEDICINE_DOSE_GIVEN',
            tenantId: scope.tenantId,
            unitId: scope.unitId
        })));
    } catch (error) {
        console.error('Medication dose saved but notification dispatch failed:', error);
    }
};

const resolveFamilyUserIdsForPatient = async (patientId: string, scope: { tenantId: string; unitId: string }) => {
    const userIds = new Set<string>();
    
    // Find client details via Admission -> Enquiry -> Client
    const admissions = await (prisma as any).admission.findMany({
        where: {
            patientId,
            tenantId: scope.tenantId
        },
        select: {
            enquiry: {
                select: {
                    client: {
                        select: { email: true, mobile: true }
                    }
                }
            }
        }
    });

    const OR: any[] = [];
    admissions.forEach((adm: any) => {
        const client = adm.enquiry?.client;
        if (!client) return;
        const clientEmail = String(client.email || '').trim();
        const clientMobile = normalizePhone(client.mobile);
        if (clientEmail) OR.push({ email: { equals: clientEmail, mode: 'insensitive' } });
        if (clientMobile) OR.push({ mobile: { contains: clientMobile } });
    });

    if (OR.length) {
        const familyUsers = await (prisma as any).user.findMany({
            where: {
                tenantId: scope.tenantId,
                isDeleted: false,
                isActive: true,
                OR,
                role: { name: { in: ['Family Member', 'Client Family Member', 'Client'] } }
            },
            select: { id: true }
        });
        familyUsers.forEach((user: any) => userIds.add(user.id));
    }
    return Array.from(userIds);
};

const notifyAbnormalVitals = async (patientName: string, patientId: string, abnormalEntries: any[], scope: { tenantId: string; unitId: string }) => {
    try {
        const userIds = await resolveFamilyUserIdsForPatient(patientId, scope);
        if (!userIds.length) return;

        const summary = abnormalEntries.map(e => Object.entries(e).map(([k, v]) => `${k}: ${v}`).join(', ')).join(' | ');
        const message = `Alert: Abnormal vitals detected for ${patientName}. Details: ${summary}`;

        await Promise.allSettled(userIds.map((userId) => sendNotification({
            userId,
            message,
            type: 'ABNORMAL_VITAL_ALERT',
            tenantId: scope.tenantId,
            unitId: scope.unitId
        })));
    } catch (error) {
        console.error('Failed to send abnormal vital alert:', error);
    }
};

const notifyDailyCareSummary = async (patientName: string, patientId: string, scope: { tenantId: string; unitId: string }) => {
    try {
        const userIds = await resolveFamilyUserIdsForPatient(patientId, scope);
        if (!userIds.length) return;

        const message = `Daily Care Summary: Activities of daily living (ADL) for ${patientName} have been marked as completed for today.`;

        await Promise.allSettled(userIds.map((userId) => sendNotification({
            userId,
            message,
            type: 'DAILY_CARE_SUMMARY',
            tenantId: scope.tenantId,
            unitId: scope.unitId
        })));
    } catch (error) {
        console.error('Failed to send daily care summary:', error);
    }
};

const backfillMedicineIssueLedgerEntry = async (payload: any, scope: { tenantId: string; unitId: string }, userId?: string | null) => {
    const medicineIssueId = String(payload?.medicineIssueId || '').trim();
    if (!medicineIssueId) return;

    try {
        await ensurePatientBillingTables();
        await (prisma as any).$transaction(async (tx: any) => {
            const rows = await tx.$queryRaw`
                SELECT *
                FROM "StockIssueRequest"
                WHERE "id" = ${medicineIssueId}
                  AND "tenantId" = ${scope.tenantId}
                  AND "unitId" = ${scope.unitId}
                  AND "status" = 'APPROVED'
                  AND "isDeleted" = false
                LIMIT 1
            `;
            const request = rows?.[0];
            if (!request) return null;

            return postStockIssueToPatientLedger(tx, request, userId || null);
        });
    } catch (error) {
        console.error('Medication dose saved but patient ledger backfill failed:', error);
    }
};

// POST /api/v1/patient
router.post('/patient', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = patientSchema.parse(req.body);
        const scope = getScope(req);
        const currentYear = new Date().getFullYear();
        const elderId = await generateRefNumber(`UEC-ELD-${currentYear}`, scope.tenantId, scope.unitId);

        const patient = await (prisma as any).patient.create({
            data: {
                elderId,
                ...validated,
                ...getScope(req)
            }
        });
        res.status(201).json({ success: true, data: patient, message: 'Patient registered successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/v1/patient
router.get('/patient', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const patients = await (prisma as any).patient.findMany({
            where: getReadScope(req),
            include: {
                admissions: {
                    include: {
                        enquiry: {
                            select: {
                                id: true,
                                refNo: true,
                                rawMessage: true,
                                service: {
                                    select: {
                                        id: true,
                                        name: true,
                                        category: true
                                    }
                                },
                                client: {
                                    select: {
                                        id: true,
                                        name: true,
                                        mobile: true
                                    }
                                }
                            }
                        }
                    }
                },
                medications: true,
                nutritions: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: patients });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/v1/caregiver-vital-charts?month=YYYY-MM&patientId=
router.get('/caregiver-vital-charts', auth, enforceTenant, async (req: any, res: any) => {
    try {
        await ensureCaregiverVitalChartTable();
        const scope = getScope(req);
        const month = String(req.query.month || '').trim();
        const patientId = String(req.query.patientId || '').trim();

        const rows = await (prisma as any).$queryRaw`
            SELECT *
            FROM "CaregiverVitalChart"
            WHERE "tenantId" = ${scope.tenantId}
              AND "unitId" = ${scope.unitId}
              AND "isDeleted" = false
              AND (${month || null}::text IS NULL OR "month" = ${month || null})
              AND (${patientId || null}::text IS NULL OR "patientId" = ${patientId || null})
            ORDER BY "month" DESC, "updatedAt" DESC
        `;

        res.json({ success: true, data: rows.map(toCaregiverVitalChart) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/v1/caregiver-vital-charts
router.post('/caregiver-vital-charts', auth, enforceTenant, async (req: any, res: any) => {
    try {
        await ensureCaregiverVitalChartTable();
        const validated = caregiverVitalChartSchema.parse(req.body);
        const scope = getScope(req);

        debugCaregiverVitalChart('received save payload', {
            patientId: validated.patientId,
            admissionId: validated.admissionId || null,
            enquiryId: validated.enquiryId || null,
            allocationId: validated.allocationId || null,
            month: validated.month,
            tenantId: scope.tenantId,
            unitId: scope.unitId
        });

        const patient = await resolveCaregiverVitalChartPatient(validated, scope);

        if (!patient) {
            debugCaregiverVitalChart('patient resolution failed', {
                patientId: validated.patientId,
                admissionId: validated.admissionId || null,
                enquiryId: validated.enquiryId || null,
                allocationId: validated.allocationId || null,
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                reason: 'No patient master, admission, or in-house allocation matched this chart scope'
            });
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const patientName = validated.patientName || patient.name;
        const rows = await (prisma as any).$queryRaw`
            INSERT INTO "CaregiverVitalChart" (
                "id", "patientId", "patientName", "age", "sex", "month", "entries", "signatures",
                "status", "tenantId", "unitId", "createdBy", "createdAt", "updatedAt"
            )
            VALUES (
                ${randomUUID()}, ${patient.id}, ${patientName}, ${validated.age || null},
                ${validated.sex || null}, ${validated.month}, ${JSON.stringify(validated.entries)}::jsonb,
                ${JSON.stringify(validated.signatures || {})}::jsonb, ${validated.status || 'DRAFT'},
                ${scope.tenantId}, ${scope.unitId}, ${req.user.id || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT ("patientId", "month", "tenantId", "unitId")
            WHERE "isDeleted" = false
            DO UPDATE SET
                "patientName" = EXCLUDED."patientName",
                "age" = EXCLUDED."age",
                "sex" = EXCLUDED."sex",
                "entries" = EXCLUDED."entries",
                "signatures" = EXCLUDED."signatures",
                "status" = EXCLUDED."status",
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const savedChart = toCaregiverVitalChart(rows[0]);

        // Check for abnormal vitals in the entries (basic thresholds)
        const newEntries = validated.entries || [];
        const abnormal = newEntries.filter(entry => {
            let isAbnormal = false;
            const check = (val: string, min: number, max: number) => {
                const num = parseFloat(val);
                return !isNaN(num) && (num < min || num > max);
            };
            if (check(entry.tempMor, 95, 99) || check(entry.tempEve, 95, 99)) isAbnormal = true;
            if (check(entry.spo2Mor, 95, 100) || check(entry.spo2Eve, 95, 100)) isAbnormal = true;
            if (check(entry.bpMor?.split('/')[0], 90, 140) || check(entry.bpEve?.split('/')[0], 90, 140)) isAbnormal = true;
            if (check(entry.pulseMor, 60, 100) || check(entry.pulseEve, 60, 100)) isAbnormal = true;
            return isAbnormal;
        });

        if (abnormal.length > 0) {
            await notifyAbnormalVitals(patientName, patient.id, abnormal, scope);
        }

        // Sync the latest vital to the VitalSign table for cross-module consistency
        const latestEntry = [...newEntries].reverse().find(e => e.bpMor || e.pulseMor || e.tempMor || e.spo2Mor || e.bpEve || e.pulseEve || e.tempEve || e.spo2Eve);
        if (latestEntry) {
            const bp = latestEntry.bpEve || latestEntry.bpMor || null;
            const pulse = parseInt(latestEntry.pulseEve || latestEntry.pulseMor || '0') || null;
            const temp = parseFloat(latestEntry.tempEve || latestEntry.tempMor || '0') || null;
            const spo2 = parseInt(latestEntry.spo2Eve || latestEntry.spo2Mor || '0') || null;

            if (bp || pulse || temp || spo2) {
                // Upsert a VitalSign for this patient to ensure Patient Care dashboard is updated
                // We'll update the most recent one if it's within the last 24h, else create new
                const recentVital = await (prisma as any).vitalSign.findFirst({
                    where: { 
                        patientId: patient.id,
                        tenantId: scope.tenantId
                    },
                    orderBy: { createdAt: 'desc' }
                });

                if (recentVital) {
                    await (prisma as any).vitalSign.update({
                        where: { id: recentVital.id },
                        data: { bp, pulse, temp, spO2: spo2, recordedById: req.user.id || 'system' }
                    });
                } else {
                    await (prisma as any).vitalSign.create({
                        data: {
                            patientId: patient.id,
                            tenantId: scope.tenantId,
                            unitId: scope.unitId,
                            bp,
                            pulse,
                            temp,
                            spO2: spo2,
                            recordedById: req.user.id || 'system',
                            notes: 'Synced from Caregiver Chart'
                        }
                    });
                }
            }
        }

        res.status(201).json({
            success: true,
            data: savedChart,
            message: 'Caregiver vital chart saved'
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// POST /api/v1/medication
router.post('/medication', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = medicationSchema.parse(req.body);
        const medication = await (prisma as any).medication.create({
            data: { ...validated }
        });
        res.status(201).json({ success: true, data: medication, message: 'Medication added successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/v1/medication-schedules
router.get('/medication-schedules', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const patientId = req.query.patientId ? String(req.query.patientId).trim() : undefined;
        const schedules = await (prisma as any).auditLog.findMany({
            where: {
                ...getReadScope(req),
                module: medicationScheduleModule,
                action: medicationScheduleAction,
                isDeleted: false,
                ...(patientId ? {
                    payload: {
                        path: ['patientId'],
                        equals: patientId
                    }
                } : {})
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: schedules.map(toMedicationSchedule) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/v1/medication-schedules
router.post('/medication-schedules', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = medicationScheduleSchema.parse(req.body);
        const schedule = await (prisma as any).auditLog.create({
            data: {
                userId: req.user.id,
                module: medicationScheduleModule,
                action: medicationScheduleAction,
                payload: {
                    ...validated,
                    status: 'SCHEDULED',
                    administeredSlots: [],
                    administeredHistory: []
                },
                ...getScope(req)
            }
        });

        res.status(201).json({ success: true, data: toMedicationSchedule(schedule), message: 'Medication schedule saved successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// PATCH /api/v1/medication-schedules/:id/administer
router.patch('/medication-schedules/:id/administer', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = administerDoseSchema.parse(req.body);
        const scope = getScope(req);
        const existing = await (prisma as any).auditLog.findFirst({
            where: {
                id: req.params.id,
                ...scope,
                module: medicationScheduleModule,
                action: medicationScheduleAction,
                isDeleted: false
            }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Medication schedule not found' });
        }

        const payload = existing.payload && typeof existing.payload === 'object' && !Array.isArray(existing.payload) ? existing.payload : {};
        const previousSlots = Array.isArray(payload.administeredSlots) ? payload.administeredSlots : [];
        const previousHistory = Array.isArray(payload.administeredHistory) ? payload.administeredHistory : [];
        const administeredSlots = Array.from(new Set([...previousSlots, validated.slot]));
        const times = Array.isArray(payload.times) ? payload.times : [];
        const status = times.length > 0 && administeredSlots.length >= times.length ? 'COMPLETED' : 'IN_PROGRESS';

        const updated = await (prisma as any).auditLog.update({
            where: { id: existing.id },
            data: {
                userId: req.user.id,
                payload: {
                    ...payload,
                    status,
                    administeredSlots,
                    administeredHistory: [
                        ...previousHistory,
                        {
                            slot: validated.slot,
                            remarks: validated.remarks,
                            administeredBy: req.user.name || req.user.email || req.user.id,
                            administeredAt: new Date().toISOString()
                        }
                    ]
                }
            }
        });

        const medicationSchedule = toMedicationSchedule(updated);
        await notifyDoseAdministration(medicationSchedule, scope);
        await backfillMedicineIssueLedgerEntry(medicationSchedule, scope, req.user?.id || null);

        res.json({ success: true, data: medicationSchedule, message: 'Medication dose marked as administered' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// POST /api/v1/nutrition
router.post('/nutrition', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = nutritionSchema.parse(req.body);
        const nutrition = await (prisma as any).nutrition.create({
            data: { ...validated }
        });
        res.status(201).json({ success: true, data: nutrition, message: 'Nutrition plan added successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/v1/nutrition
router.get('/nutrition', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const patientId = req.query.patientId ? String(req.query.patientId).trim() : undefined;
        const nutritionPlans = await (prisma as any).nutrition.findMany({
            where: {
                ...(patientId ? { patientId } : {}),
                patient: {
                    ...getReadScope(req)
                }
            },
            include: {
                patient: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: nutritionPlans });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/v1/adl-records
router.get('/adl-records', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const scope = getScope(req);
        const patientId = req.query.patientId ? String(req.query.patientId).trim() : undefined;
        const records = await (prisma as any).aDLRecord.findMany({
            where: {
                ...scope,
                ...(patientId ? { patientId } : {})
            },
            orderBy: { createdAt: 'desc' }
        });

        const patientIds = Array.from(new Set(records
            .map((record: any) => record.patientId)
            .filter(Boolean)));
        const patients = patientIds.length
            ? await (prisma as any).patient.findMany({
                where: {
                    id: { in: patientIds },
                    ...scope
                },
                select: { id: true, elderId: true, name: true, tenantId: true, unitId: true, createdAt: true, updatedAt: true }
            })
            : [];
        const patientMap = new Map<string, any>(patients.map((patient: any) => [patient.id, patient]));

        res.json({ success: true, data: records.map((record: any) => toAdlRecord(record, patientMap)) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/v1/adl-records
router.post('/adl-records', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = adlSchema.parse(req.body);
        const scope = getScope(req);
        const patient = await (prisma as any).patient.findFirst({
            where: {
                id: validated.patientId,
                ...scope
            },
            select: { id: true, elderId: true, name: true, tenantId: true, unitId: true, createdAt: true, updatedAt: true }
        });

        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const record = await (prisma as any).aDLRecord.create({
            data: {
                patientId: validated.patientId,
                mobility: validated.mobility || '',
                hygiene: validated.hygiene || '',
                feeding: validated.feeding || '',
                notes: validated.notes || '',
                status: 'RECORDED',
                recordedById: req.user.id,
                ...scope
            }
        });

        res.status(201).json({
            success: true,
            data: toAdlRecord(record, new Map([[patient.id, patient]])),
            message: 'ADL record saved successfully'
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// PATCH /api/v1/adl-records/:id/status
router.patch('/adl-records/:id/status', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = adlStatusSchema.parse(req.body);
        const scope = getScope(req);
        
        const existing = await (prisma as any).aDLRecord.findFirst({
            where: {
                id: req.params.id,
                ...scope
            }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'ADL record not found' });
        }

        const updated = await (prisma as any).aDLRecord.update({
            where: { id: existing.id },
            data: {
                status: validated.status
            }
        });

        const payload = updated;

        const patientId = String(payload.patientId || '');
        if (validated.status === 'COMPLETED' && patientId) {
            const patient = await (prisma as any).patient.findUnique({ where: { id: patientId }, select: { name: true } });
            if (patient) {
                await notifyDailyCareSummary(patient.name, patientId, scope);
            }
        }

        const patientMap = new Map();
        if (patientId) {
            const patient = await (prisma as any).patient.findUnique({ where: { id: patientId } });
            if (patient) patientMap.set(patient.id, patient);
        }

        res.json({
            success: true,
            data: toAdlRecord(updated, patientMap),
            message: 'ADL status updated'
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

export default router;
