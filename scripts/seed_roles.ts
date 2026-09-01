import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding specific role users...')

    const tenant = await prisma.tenant.findFirst()
    const unit = await prisma.unit.findFirst()

    if (!tenant || !unit) {
        console.error('Core structures (tenant, unit) are missing. Please seed core first.')
        process.exit(1)
    }

    const rolesToSeed = [
        { email: 'frontdesk@demo.com', role: 'FRONTDESK', name: 'Demo Frontdesk' },
        { email: 'administrative@demo.com', role: 'ADMINISTRATIVE', name: 'Demo Administrative' },
        { email: 'patientcare@demo.com', role: 'PATIENT_CARE_STAFF', name: 'Demo Patient Care' },
        { email: 'nursingcare@demo.com', role: 'NURSING_CARE_STAFF', name: 'Demo Nursing Care' },
        { email: 'inventoryfood@demo.com', role: 'INVENTORY_FOOD', name: 'Demo Inventory Food' },
        { email: 'inventorymedical@demo.com', role: 'INVENTORY_MEDICAL', name: 'Demo Inventory Medical' }
    ]

    const passwordHash = await bcrypt.hash('Password@123', 10)

    for (const data of rolesToSeed) {
        // Ensure role exists
        let role = await prisma.role.findFirst({
            where: { name: data.role, tenantId: tenant.id }
        })

        if (!role) {
            role = await prisma.role.create({
                data: {
                    name: data.role,
                    description: `System generated ${data.role} role`,
                    tenantId: tenant.id
                }
            })
        }

        const user = await prisma.user.upsert({
            where: { email: data.email },
            update: {
                roleId: role.id,
                isActive: true
            },
            create: {
                email: data.email,
                passwordHash,
                firstName: data.name,
                roleId: role.id,
                isActive: true,
                tenantId: tenant.id,
                unitId: unit.id
            }
        })
        console.log(`Ensured user ${user.email} exists with role ${data.role} and password: Password@123`)
    }

    console.log('Done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })