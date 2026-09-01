import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
import bcrypt from 'bcrypt';
import { seedDemoData } from './seeds/demoData.js';
import { seedEntityData } from './seeds/entityData.js';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding initial data...');
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@erp.com';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 1. Create a Default Tenant
    const tenant = await prisma.tenant.upsert({
        where: { code: 'DEFAULT_TENANT' },
        update: {},
        create: {
            name: 'Artibots Innov ERP',
            code: 'DEFAULT_TENANT',
            plan: 'ENTERPRISE'
        }
    });

    const defaultLocation = await prisma.location.upsert({
        where: {
            name_state_country_pincode: {
                name: 'Coimbatore',
                state: 'Tamil Nadu',
                country: 'India',
                pincode: '641001'
            }
        },
        update: {},
        create: {
            name: 'Coimbatore',
            state: 'Tamil Nadu',
            country: 'India',
            pincode: '641001'
        }
    });

    // 2. Create a Default Unit
    const unit = await prisma.unit.upsert({
        where: { code: 'HQ_UNIT' },
        update: {
            locationId: defaultLocation.id
        },
        create: {
            name: 'Headquarters',
            code: 'HQ_UNIT',
            tenantId: tenant.id,
            locationId: defaultLocation.id
        }
    });

    // 3. Create Default Roles
    const adminRole = await prisma.role.upsert({
        where: { name_tenantId: { name: 'Admin', tenantId: tenant.id } },
        update: {},
        create: {
            name: 'Admin',
            description: 'Super Administrator with all access',
            tenantId: tenant.id
        }
    });

    // 4. Create Base Permissions
    const createEnquiryPerm = await prisma.permission.upsert({
        where: { module_action: { module: 'ENQUIRY', action: 'CREATE' } },
        update: {},
        create: { module: 'ENQUIRY', action: 'CREATE', description: 'Create new enquiries' }
    });

    const readEnquiryPerm = await prisma.permission.upsert({
        where: { module_action: { module: 'ENQUIRY', action: 'READ' } },
        update: {},
        create: { module: 'ENQUIRY', action: 'READ', description: 'Read enquiries list' }
    });

    const updateEnquiryPerm = await prisma.permission.upsert({
        where: { module_action: { module: 'ENQUIRY', action: 'UPDATE' } },
        update: {},
        create: { module: 'ENQUIRY', action: 'UPDATE', description: 'Update enquiries' }
    });

    const deleteEnquiryPerm = await prisma.permission.upsert({
        where: { module_action: { module: 'ENQUIRY', action: 'DELETE' } },
        update: {},
        create: { module: 'ENQUIRY', action: 'DELETE', description: 'Delete enquiries' }
    });

    const readIntellPerm = await prisma.permission.upsert({
        where: { module_action: { module: 'INTELLIGENCE', action: 'READ' } },
        update: {},
        create: { module: 'INTELLIGENCE', action: 'READ', description: 'Read intelligence data' }
    });

    const adminIntellPerm = await prisma.permission.upsert({
        where: { module_action: { module: 'INTELLIGENCE', action: 'ADMIN' } },
        update: {},
        create: { module: 'INTELLIGENCE', action: 'ADMIN', description: 'Manage intelligence rules' }
    });

    // 5. Assign Permissions to Admin Role
    const permsToAssign = [
        createEnquiryPerm, readEnquiryPerm, updateEnquiryPerm, deleteEnquiryPerm,
        readIntellPerm, adminIntellPerm
    ];

    for (const p of permsToAssign) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
            update: {},
            create: { roleId: adminRole.id, permissionId: p.id, tenantId: tenant.id }
        });
    }

    // 6. Create Default Admin User
    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            passwordHash: hashedPassword,
            firstName: 'Raghav',
            lastName: '',
            roleId: adminRole.id,
            tenantId: tenant.id,
            unitId: unit.id
        },
        create: {
            email: adminEmail,
            passwordHash: hashedPassword,
            firstName: 'Raghav',
            lastName: '',
            roleId: adminRole.id,
            tenantId: tenant.id,
            unitId: unit.id
        }
    });

    await seedEntityData(prisma, tenant, adminUser);

    try {
        await seedDemoData(prisma, tenant, unit, adminUser);
    } catch (error) {
        console.warn('Full demo seed skipped because optional demo schema is not fully available:', error?.message || error);
    }

    console.log('✅ Seeding completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
