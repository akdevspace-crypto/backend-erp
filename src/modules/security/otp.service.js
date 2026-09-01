import crypto from 'crypto';
import { prisma } from '../../app/prisma.js';
import { sendSMS } from '../../services/twilioService.js';

const otpModule = 'SECURITY_OTP';
const otpAction = 'OTP_REQUESTED';
const otpExpiryMinutes = 5;
const maxAttempts = 5;
const requestCooldownSeconds = 60;

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    error.statusCode = status;
    return error;
};

const normalizeString = (value) => String(value || '').trim();
const normalizeMobile = (value) => {
    const trimmed = normalizeString(value);
    const digits = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+')) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    return digits ? `+${digits}` : '';
};
const getOtpSecret = () => process.env.OTP_SECRET || process.env.JWT_SECRET || 'erp-security-otp-secret';
const hashOtp = (otp) => crypto.createHmac('sha256', getOtpSecret()).update(String(otp)).digest('hex');
const createOtp = () => crypto.randomInt(100000, 1000000).toString();

const readPayload = (row) =>
    row?.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? row.payload
        : {};

const maskMobile = (mobile) => {
    const value = normalizeMobile(mobile);
    if (value.length <= 4) return value;
    return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const normalizeOtpLog = (row) => {
    const payload = readPayload(row);
    return {
        id: row.id,
        mobile: maskMobile(payload.mobile),
        purpose: payload.purpose || '',
        referenceId: payload.referenceId || null,
        status: payload.status || 'PENDING',
        deliveryStatus: payload.deliveryStatus || 'PENDING',
        attempts: Number(payload.attempts || 0),
        expiresAt: payload.expiresAt || null,
        verifiedAt: payload.verifiedAt || null,
        createdAt: row.createdAt,
        unitId: row.unitId,
        requestedBy: row.user?.firstName || row.user?.email || payload.requestedBy || '-'
    };
};

export const otpPurposes = {
    visitorCheckIn: 'Visitor check-in verification',
    visitorCheckout: 'Visitor checkout verification'
};

export const listOtpLogs = async ({ tenantId, unitId, includeTenant = false }) => {
    const rows = await prisma.auditLog.findMany({
        where: {
            tenantId,
            ...(includeTenant ? {} : { unitId }),
            module: otpModule,
            isDeleted: false
        },
        include: {
            user: {
                select: {
                    firstName: true,
                    email: true
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 250
    });

    return rows.map(normalizeOtpLog);
};

const latestByPurpose = (rows) => rows.reduce((summary, row) => {
    const payload = readPayload(row);
    const purpose = payload.purpose;
    if (!purpose || summary[purpose]) return summary;

    summary[purpose] = normalizeOtpLog(row);
    return summary;
}, {});

export const getOtpSummariesForReferences = async ({ tenantId, unitId, referenceIds, includeTenant = false }) => {
    const ids = [...new Set((referenceIds || []).map(normalizeString).filter(Boolean))];
    if (ids.length === 0) return new Map();

    const rows = await prisma.auditLog.findMany({
        where: {
            tenantId,
            ...(includeTenant ? {} : { unitId }),
            module: otpModule,
            isDeleted: false,
            OR: ids.map((id) => ({
                payload: { path: ['referenceId'], equals: id }
            }))
        },
        include: {
            user: {
                select: {
                    firstName: true,
                    email: true
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(250, ids.length * 4)
    });

    const grouped = new Map();
    for (const row of rows) {
        const payload = readPayload(row);
        const referenceId = normalizeString(payload.referenceId);
        if (!referenceId || grouped.has(referenceId)) continue;

        grouped.set(referenceId, latestByPurpose(rows.filter((candidate) => readPayload(candidate).referenceId === referenceId)));
    }

    return grouped;
};

export const hasVerifiedOtpForReference = async ({ tenantId, unitId, referenceId, purpose, includeTenant = false }) => {
    const existing = await prisma.auditLog.findFirst({
        where: {
            tenantId,
            ...(includeTenant ? {} : { unitId }),
            module: otpModule,
            isDeleted: false,
            AND: [
                { payload: { path: ['referenceId'], equals: normalizeString(referenceId) } },
                { payload: { path: ['purpose'], equals: normalizeString(purpose) } },
                { payload: { path: ['status'], equals: 'VERIFIED' } }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    return Boolean(existing);
};

export const requestOtp = async ({ tenantId, unitId, userId, userName, mobile, purpose, referenceId }) => {
    const normalizedMobile = normalizeMobile(mobile);
    const normalizedPurpose = normalizeString(purpose);
    const normalizedReferenceId = normalizeString(referenceId);

    if (!/^\+?\d{10,15}$/.test(normalizedMobile)) {
        throw buildHttpError('Enter a valid mobile number with 10 digits or country code');
    }
    if (!normalizedPurpose) {
        throw buildHttpError('OTP purpose is required');
    }

    const recentRequest = await prisma.auditLog.findFirst({
        where: {
            tenantId,
            unitId,
            module: otpModule,
            isDeleted: false,
            createdAt: {
                gte: new Date(Date.now() - requestCooldownSeconds * 1000)
            },
            AND: [
                { payload: { path: ['mobile'], equals: normalizedMobile } },
                { payload: { path: ['purpose'], equals: normalizedPurpose } }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    if (recentRequest) {
        throw buildHttpError(`Wait ${requestCooldownSeconds} seconds before requesting another OTP`, 429);
    }

    const otp = createOtp();
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000).toISOString();
    const created = await prisma.auditLog.create({
        data: {
            userId,
            module: otpModule,
            action: otpAction,
            tenantId,
            unitId,
            payload: {
                mobile: normalizedMobile,
                purpose: normalizedPurpose,
                referenceId: normalizedReferenceId || null,
                otpHash: hashOtp(otp),
                status: 'PENDING',
                deliveryStatus: 'PENDING',
                attempts: 0,
                maxAttempts,
                expiresAt,
                verifiedAt: null,
                requestedBy: userName
            }
        }
    });

    try {
        await sendSMS(
            normalizedMobile,
            `Your ERP security verification code is ${otp}. It expires in ${otpExpiryMinutes} minutes. Do not share this code.`
        );

        const updated = await prisma.auditLog.update({
            where: { id: created.id },
            data: {
                payload: {
                    ...readPayload(created),
                    deliveryStatus: 'SENT'
                }
            }
        });

        return {
            log: normalizeOtpLog(updated),
            developmentOtp: null
        };
    } catch (error) {
        const updated = await prisma.auditLog.update({
            where: { id: created.id },
            data: {
                payload: {
                    ...readPayload(created),
                    status: process.env.NODE_ENV === 'production' ? 'DELIVERY_FAILED' : 'PENDING',
                    deliveryStatus: 'FAILED',
                    deliveryError: normalizeString(error?.message).slice(0, 200)
                }
            }
        });

        if (process.env.NODE_ENV === 'production') {
            throw buildHttpError('OTP could not be delivered. Check the SMS provider configuration and retry.', 502);
        }

        return {
            log: normalizeOtpLog(updated),
            developmentOtp: otp
        };
    }
};

export const verifyOtp = async ({ id, tenantId, unitId, includeTenant = false, otp }) => {
    const normalizedOtp = normalizeString(otp);
    if (!/^\d{6}$/.test(normalizedOtp)) {
        throw buildHttpError('Enter the six-digit OTP');
    }

    const existing = await prisma.auditLog.findFirst({
        where: {
            id,
            tenantId,
            ...(includeTenant ? {} : { unitId }),
            module: otpModule,
            isDeleted: false
        }
    });

    if (!existing) throw buildHttpError('OTP request not found', 404);

    const payload = readPayload(existing);
    if (payload.status === 'VERIFIED') throw buildHttpError('OTP is already verified');
    if (payload.status === 'DELIVERY_FAILED') throw buildHttpError('OTP delivery failed. Request a new OTP');

    const attempts = Number(payload.attempts || 0);
    if (attempts >= maxAttempts || payload.status === 'LOCKED') {
        throw buildHttpError('OTP verification is locked. Request a new OTP', 429);
    }

    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
        await prisma.auditLog.update({
            where: { id: existing.id },
            data: {
                payload: {
                    ...payload,
                    status: 'EXPIRED'
                }
            }
        });
        throw buildHttpError('OTP has expired. Request a new OTP', 410);
    }

    const storedHash = Buffer.from(String(payload.otpHash || ''));
    const submittedHash = Buffer.from(hashOtp(normalizedOtp));
    const isValid = storedHash.length === submittedHash.length
        && crypto.timingSafeEqual(storedHash, submittedHash);

    if (!isValid) {
        const nextAttempts = attempts + 1;
        const locked = nextAttempts >= maxAttempts;
        await prisma.auditLog.update({
            where: { id: existing.id },
            data: {
                payload: {
                    ...payload,
                    attempts: nextAttempts,
                    status: locked ? 'LOCKED' : 'PENDING'
                }
            }
        });
        throw buildHttpError(
            locked ? 'OTP verification is locked. Request a new OTP' : 'Invalid OTP',
            locked ? 429 : 400
        );
    }

    const updated = await prisma.auditLog.update({
        where: { id: existing.id },
        data: {
            action: 'OTP_VERIFIED',
            payload: {
                ...payload,
                status: 'VERIFIED',
                attempts: attempts + 1,
                verifiedAt: new Date().toISOString()
            }
        },
        include: {
            user: {
                select: {
                    firstName: true,
                    email: true
                }
            }
        }
    });

    return normalizeOtpLog(updated);
};
