import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/app/prisma.js';

const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@erp.com';
const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

const tenantId = 'fc75cbca-5a45-46e9-9905-521d708e5ebe';
const unitId = 'f7dab772-a5b3-404f-80bc-c5a4f5f03405';
const roleId = '00000000-0000-0000-0000-000000000001';

async function main() {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.tenant.upsert({
        where: { id: tenantId },
        update: {
            name: 'Universal ERP',
            code: 'DEFAULT',
            plan: 'ENTERPRISE',
            isActive: true,
            isDeleted: false
        },
        create: {
            id: tenantId,
            name: 'Universal ERP',
            code: 'DEFAULT',
            plan: 'ENTERPRISE'
        }
    });

    await prisma.location.upsert({
        where: { id: 'default-location' },
        update: {
            name: 'Default Location',
            state: 'Default',
            country: 'India'
        },
        create: {
            id: 'default-location',
            name: 'Default Location',
            state: 'Default',
            country: 'India'
        }
    });

    await prisma.unit.upsert({
        where: { id: unitId },
        update: {
            name: 'Default Unit',
            code: 'DEFAULT',
            locationId: 'default-location',
            tenantId,
            status: true,
            isDeleted: false
        },
        create: {
            id: unitId,
            name: 'Default Unit',
            code: 'DEFAULT',
            locationId: 'default-location',
            tenantId
        }
    });

    await prisma.role.upsert({
        where: { id: roleId },
        update: {
            name: 'Admin',
            description: 'Default administrator role',
            tenantId,
            isDeleted: false
        },
        create: {
            id: roleId,
            name: 'Admin',
            description: 'Default administrator role',
            tenantId
        }
    });

    const user = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            passwordHash,
            firstName: 'Raghav',
            lastName: '',
            roleId,
            tenantId,
            unitId,
            isActive: true,
            isDeleted: false
        },
        create: {
            email: adminEmail,
            passwordHash,
            firstName: 'Raghav',
            lastName: '',
            roleId,
            tenantId,
            unitId,
            isActive: true,
            isDeleted: false
        },
        select: {
            email: true,
            firstName: true,
            isActive: true
        }
    });

    console.log(JSON.stringify({ ensured: true, email: user.email, firstName: user.firstName, isActive: user.isActive }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
