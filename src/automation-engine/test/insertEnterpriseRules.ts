import { PrismaClient } from "@prisma/client";
import { prisma } from '../../app/prisma.js';




async function insertEnterpriseRules() {
    console.log("🚀 Inserting (Corrected) Cross-Module Intelligence Rules...");

    const tenantId = "test-tenant";
    const unitId = "test-unit";

    // Skip cleanup if it fails frequently; just creating more for now
    // 💰 ACCOUNTS RULES (Anomaly Detection)
    await prisma.automationRule.create({
        data: {
            tenantId,
            unitId,
            module: "accounts",
            name: "High Value Transaction (Anomaly Signal) - V2",
            conditions: {
                logic: "AND",
                conditions: [
                    { field: "input.amount", operator: ">", value: 100000 }
                ]
            },
            action: "add_score",
            actionValue: "50",
            priority: 1
        }
    });

    await prisma.automationRule.create({
        data: {
            tenantId,
            unitId,
            module: "accounts",
            name: "High Frequency Transfers - V2",
            conditions: {
                logic: "AND",
                conditions: [
                    { field: "input.frequency", operator: ">", value: 5 }
                ]
            },
            action: "add_score",
            actionValue: "40",
            priority: 2
        }
    });

    // 👥 HR RULES (Attrition Risk)
    await prisma.automationRule.create({
        data: {
            tenantId,
            unitId,
            module: "hr",
            name: "High Absenteeism Signal - V2",
            conditions: {
                logic: "AND",
                conditions: [
                    { field: "input.absenteeism", operator: ">", value: 10 }
                ]
            },
            action: "add_score",
            actionValue: "40",
            priority: 1
        }
    });

    console.log("✅ Enterprise Rules inserted successfully.");
    process.exit(0);
}

insertEnterpriseRules().catch(err => {
    console.error(err);
    process.exit(1);
});
