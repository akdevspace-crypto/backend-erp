import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        console.error('❌ SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not found in .env');
        process.exit(1);
    }

    console.log('Updating super admin credentials...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Find the current admin (by old email or by role)
    // First try finding the old default admin
    let user = await prisma.user.findUnique({
        where: { email: 'admin@erp.com' }
    });

    if (!user) {
        // Try finding by the new email in case it was already partially set up
        user = await prisma.user.findUnique({
            where: { email: adminEmail }
        });
    }

    if (!user) {
        // Try finding any user with 'Admin' role
        user = await prisma.user.findFirst({
            where: { role: { name: 'Admin' } }
        });
    }

    if (user) {
        await prisma.user.update({
            where: { id: user.id },
            data: {
                email: adminEmail,
                passwordHash: hashedPassword,
                firstName: 'Raghav',
                lastName: ''
            }
        });
        console.log(`✅ Updated user ${user.id} to ${adminEmail}`);
    } else {
        console.log('❓ No admin user found to update. You might need to run the seed script.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
