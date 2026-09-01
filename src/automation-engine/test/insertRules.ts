import { PrismaClient } from "@prisma/client";
import { prisma } from '../../app/prisma.js';




async function insertRules() {
    console.log("🚀 Starting Rule Insertion...");

    const rules = [
        {
            name: "High Value Service (In-House Care)",
            module: "enquiry",
            conditions: {
                logic: "AND",
                conditions: [
                    {
                        field: "input.serviceType",
                        operator: "=",
                        value: "In-House Care"
                    }
                ]
            },
            action: "add_score",
            actionValue: "50",
            tenantId: "test-tenant",
            unitId: "test-unit",
            status: true,
            priority: 1
        },
        {
            name: "Urgency Detection",
            module: "enquiry",
            conditions: {
                logic: "AND",
                conditions: [
                    {
                        field: "input.clientComments",
                        operator: "contains",
                        value: "urgent"
                    }
                ]
            },
            action: "add_score",
            actionValue: "30",
            tenantId: "test-tenant",
            unitId: "test-unit",
            status: true,
            priority: 2
        },
        {
            name: "High Intent Channel (Call)",
            module: "enquiry",
            conditions: {
                logic: "AND",
                conditions: [
                    {
                        field: "input.enquiryMode",
                        operator: "=",
                        value: "Call"
                    }
                ]
            },
            action: "add_score",
            actionValue: "20",
            tenantId: "test-tenant",
            unitId: "test-unit",
            status: true,
            priority: 3
        }
    ];

    for (const rule of rules) {
        // Upsert to avoid duplicates
        const existing = await prisma.automationRule.findFirst({
            where: { name: rule.name, tenantId: rule.tenantId, unitId: rule.unitId }
        });

        await prisma.automationRule.upsert({
            where: {
                id: existing?.id || "00000000-0000-0000-0000-000000000000"
            },
            update: rule,
            create: rule
        });
        console.log(`✅ Rule synchronized: ${rule.name}`);
    }

    console.log("\n🎯 All rules activated successfully!");
}

insertRules()
    .catch(err => {
        console.error("❌ Error inserting rules:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
