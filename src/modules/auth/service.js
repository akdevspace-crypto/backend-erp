import { prisma } from '../../app/prisma.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { buildSessionUser } from './access.js';

const isMissingStaffTable = (error) => error?.code === 'P2021' && error?.meta?.table === 'public.Staff';

const userLoginInclude = {
    role: true,
    tenant: true,
    unit: true,
    staff: {
        select: {
            id: true,
            empId: true,
            metadata: true
        }
    }
};

const userLoginIncludeWithoutStaff = {
    role: true,
    tenant: true,
    unit: true
};

const findLoginUser = async (email) => {
    const normalizedEmail = String(email || '').trim();

    try {
        return await prisma.user.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: 'insensitive'
                }
            },
            include: userLoginInclude
        });
    } catch (error) {
        if (!isMissingStaffTable(error)) throw error;

        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: 'insensitive'
                }
            },
            include: userLoginIncludeWithoutStaff
        });

        return user ? { ...user, staff: null } : null;
    }
};

export const loginUser = async ({ email, password }) => {
    const user = await findLoginUser(email);

    if (!user || user.isDeleted || !user.passwordHash) {
        throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
        throw new Error('User account is disabled');
    }

    const payload = {
        id: user.id,
        email: user.email,
        roleId: user.roleId,
        tenantId: user.tenantId,
        unitId: user.unitId
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'supersecretjwtkeyforerpsystem', {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET || 'supersecretjwtkeyforerpsystem', {
        expiresIn: '7d'
    });

    return {
        user: buildSessionUser(user),
        accessToken,
        refreshToken
    };
};
