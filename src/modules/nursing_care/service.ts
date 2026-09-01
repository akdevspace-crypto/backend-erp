import { randomUUID } from 'crypto';
import { prisma } from '../../app/prisma.js';
import { sendNotification } from '../notification/service.js';
import { verifyStaffAssignment } from '../medical/service.js';
import { ensurePatientBillingTables, postStockIssueToPatientLedger } from '../patient_billing/ledger.js';
import {
    caregiverVitalChartSchema,
    medicationScheduleSchema,
    administerDoseSchema,
    vitalSignSchema
} from './validation.js';
import { z } from 'zod';

const medicationScheduleModule = 'HEALTHCARE_MEDICATION';
const medicationScheduleAction = 'MEDICATION_SCHEDULE';

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

// ... helper functions for resolving patient & notifications
const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '');

const resolveFamilyUserIdsForPatient = async (patientId: string, scope: { tenantId: string; unitId: string }) => {
    const userIds = new Set<string>();
    
    const admissions = await (prisma as any).admission.findMany({
        where: { patientId, tenantId: scope.tenantId },
        select: {
            enquiry: {
                select: { client: { select: { email: true, mobile: true } } }
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
            userId, message, type: 'ABNORMAL_VITAL_ALERT', tenantId: scope.tenantId, unitId: scope.unitId
        })));
    } catch (error) {
        console.error('Failed to send abnormal vital alert:', error);
    }
};

const resolveCaregiverVitalChartPatient = async (validated: any, scope: { tenantId: string; unitId: string }) => {
    const patient = await (prisma as any).patient.findFirst({
        where: { id: validated.patientId, tenantId: scope.tenantId },
        select: { id: true, name: true, tenantId: true, unitId: true }
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
        select: { id: true, unitId: true, patient: { select: { id: true, name: true, tenantId: true, unitId: true } } }
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
            enquiry: { is: { admission: { is: { patientId: patient.id } } } }
        },
        select: {
            id: true, enquiryId: true,
            enquiry: { select: { admission: { select: { patient: { select: { id: true, name: true, tenantId: true, unitId: true } } } } } }
        }
    });

    return allocation?.enquiry?.admission?.patient || null;
};

// ==========================================
// Vitals Operations
// ==========================================

export const getCaregiverVitalChartsService = async (month: string, patientId: string, scope: { tenantId: string; unitId: string }) => {
    await ensureCaregiverVitalChartTable();
    
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

    return rows.map(toCaregiverVitalChart);
};

export const saveCaregiverVitalChartService = async (validated: any, scope: { tenantId: string; unitId: string }, userId: string | null) => {
    await ensureCaregiverVitalChartTable();
    const patient = await resolveCaregiverVitalChartPatient(validated, scope);

    if (!patient) {
        throw new Error('Patient not found');
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
            ${scope.tenantId}, ${scope.unitId}, ${userId || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
    const newEntries = validated.entries || [];
    
    const abnormal = newEntries.filter((entry: any) => {
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

    const latestEntry = [...newEntries].reverse().find((e: any) => e.bpMor || e.pulseMor || e.tempMor || e.spo2Mor || e.bpEve || e.pulseEve || e.tempEve || e.spo2Eve);
    if (latestEntry) {
        const bp = latestEntry.bpEve || latestEntry.bpMor || null;
        const pulse = parseInt(latestEntry.pulseEve || latestEntry.pulseMor || '0') || null;
        const temp = parseFloat(latestEntry.tempEve || latestEntry.tempMor || '0') || null;
        const spo2 = parseInt(latestEntry.spo2Eve || latestEntry.spo2Mor || '0') || null;

        if (bp || pulse || temp || spo2) {
            const recentVital = await (prisma as any).vitalSign.findFirst({
                where: { patientId: patient.id, tenantId: scope.tenantId },
                orderBy: { createdAt: 'desc' }
            });

            if (recentVital) {
                await (prisma as any).vitalSign.update({
                    where: { id: recentVital.id },
                    data: { bp, pulse, temp, spO2: spo2, recordedById: userId || 'system' }
                });
            } else {
                await (prisma as any).vitalSign.create({
                    data: {
                        patientId: patient.id,
                        tenantId: scope.tenantId,
                        unitId: scope.unitId,
                        bp, pulse, temp, spO2: spo2,
                        recordedById: userId || 'system',
                        notes: 'Synced from Caregiver Chart'
                    }
                });
            }
        }
    }

    return savedChart;
};

// ==========================================
// Medication Schedules
// ==========================================

export const getMedicationSchedulesService = async (patientId: string | undefined, scope: { tenantId: string; unitId?: string }) => {
    const schedules = await (prisma as any).auditLog.findMany({
        where: {
            ...scope,
            module: medicationScheduleModule,
            action: medicationScheduleAction,
            isDeleted: false,
            ...(patientId ? { payload: { path: ['patientId'], equals: patientId } } : {})
        },
        orderBy: { createdAt: 'desc' }
    });
    return schedules.map(toMedicationSchedule);
};

export const createMedicationScheduleService = async (validated: any, scope: { tenantId: string; unitId: string }, userId: string) => {
    const schedule = await (prisma as any).auditLog.create({
        data: {
            userId,
            module: medicationScheduleModule,
            action: medicationScheduleAction,
            payload: {
                ...validated,
                status: 'SCHEDULED',
                administeredSlots: [],
                administeredHistory: []
            },
            ...scope
        }
    });
    return toMedicationSchedule(schedule);
};

const readNoteValue = (notes: unknown, label: string) => {
    const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.+)$`, 'im');
    return String(notes || '').match(pattern)?.[1]?.trim() || '';
};

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
        where: { id: allocationId, tenantId: scope.tenantId, unitId: scope.unitId, isDeleted: false },
        select: {
            staff: { select: { userId: true } },
            enquiry: { select: { client: { select: { email: true, mobile: true } } } }
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
                role: { name: { in: ['Family Member', 'Client Family Member', 'Client'] } }
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
            userId, message, type: 'MEDICINE_DOSE_GIVEN', tenantId: scope.tenantId, unitId: scope.unitId
        })));
    } catch (error) {
        console.error('Medication dose saved but notification dispatch failed:', error);
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

export const administerMedicationDoseService = async (id: string, validated: any, user: any, scope: { tenantId: string; unitId: string }) => {
    const existing = await (prisma as any).auditLog.findFirst({
        where: { id, ...scope, module: medicationScheduleModule, action: medicationScheduleAction, isDeleted: false }
    });

    if (!existing) {
        throw new Error('Medication schedule not found');
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
            userId: user.id,
            payload: {
                ...payload,
                status,
                administeredSlots,
                administeredHistory: [
                    ...previousHistory,
                    {
                        slot: validated.slot,
                        remarks: validated.remarks,
                        administeredBy: user.name || user.email || user.id,
                        administeredAt: new Date().toISOString()
                    }
                ]
            }
        }
    });

    const medicationSchedule = toMedicationSchedule(updated);
    await notifyDoseAdministration(medicationSchedule, scope);
    await backfillMedicineIssueLedgerEntry(medicationSchedule, scope, user?.id || null);

    return medicationSchedule;
};

export const getVitalsService = async (patientId: string, scope: { tenantId: string; unitId: string }) => {
    return (prisma as any).vitalSign.findMany({
        where: { patientId, tenantId: scope.tenantId, unitId: scope.unitId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const saveVitalService = async (validated: any, scope: { tenantId: string; unitId: string }, user: any) => {
    const authCheck = await verifyStaffAssignment(scope.tenantId, scope.unitId, user, validated.patientId);
    if (!authCheck.authorized) {
        throw new Error(`Not authorized: ${authCheck.reason}`);
    }

    return (prisma as any).vitalSign.create({
        data: {
            ...validated,
            recordedById: user.id,
            assignmentId: authCheck.assignmentId || null,
            verified: false,
            tenantId: scope.tenantId,
            unitId: scope.unitId
        }
    });
};

export const verifyVitalService = async (id: string, notes: string | undefined, scope: { tenantId: string; unitId: string }, userId: string) => {
    return (prisma as any).vitalSign.update({
        where: { id, tenantId: scope.tenantId, unitId: scope.unitId },
        data: {
            verified: true,
            verifiedBy: userId,
            verificationNotes: notes || null
        }
    });
};

export const getPrescriptionsService = async (patientId: string | null, scope: { tenantId: string; unitId: string }) => {
    const where: any = { tenantId: scope.tenantId, unitId: scope.unitId };
    if (patientId) where.patientId = patientId;
    return (prisma as any).prescription.findMany({ where, orderBy: { createdAt: 'desc' } });
};

export const createPrescriptionService = async (validated: any, scope: { tenantId: string; unitId: string }, userId: string) => {
    return (prisma as any).prescription.create({
        data: {
            ...validated,
            doctorId: userId,
            startDate: new Date(validated.startDate),
            endDate: validated.endDate ? new Date(validated.endDate) : null,
            tenantId: scope.tenantId,
            unitId: scope.unitId
        }
    });
};

export const getMedicationLogsService = async (patientId: string | null, scope: { tenantId: string; unitId: string }) => {
    const where: any = { tenantId: scope.tenantId, unitId: scope.unitId };
    if (patientId) where.patientId = patientId;
    return (prisma as any).medicationLog.findMany({ where, orderBy: { administeredAt: 'desc' } });
};

export const administerMedicationLogService = async (validated: any, scope: { tenantId: string; unitId: string }, user: any) => {
    const authCheck = await verifyStaffAssignment(scope.tenantId, scope.unitId, user, validated.patientId);
    if (!authCheck.authorized) {
        throw new Error(`Not authorized: ${authCheck.reason}`);
    }

    const userName = user.name || user.email || user.id;

    return (prisma as any).medicationLog.create({
        data: {
            ...validated,
            administeredBy: userName,
            assignmentId: authCheck.assignmentId || null,
            tenantId: scope.tenantId,
            unitId: scope.unitId
        }
    });
};

export const verifyMedicationLogService = async (id: string, notes: string | undefined, scope: { tenantId: string; unitId: string }, userId: string) => {
    return (prisma as any).medicationLog.update({
        where: { id, tenantId: scope.tenantId, unitId: scope.unitId },
        data: {
            isVerified: true,
            verifiedBy: userId,
            notes: notes || null
        }
    });
};
