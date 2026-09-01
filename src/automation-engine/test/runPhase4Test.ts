import { TriggerEngine } from "../core/TriggerEngine.js";
import { PrismaClient } from "@prisma/client";
import { prisma } from '../../app/prisma.js';




async function runPhase4Test() {
    console.log("\n🚀 PHASE 4: PREDICTIVE SALES TEST STARTED\n");

    const tenantId = "test-tenant";
    const unitId = "test-unit";

    // 0️⃣ ENSURE SEED ENTITIES EXIST
    console.log("🛠️ Preparing seed entities...");

    // Check for existing client
    let client = await prisma.client.findFirst({ where: { mobile: "9999999999" } });
    if (!client) {
        client = await prisma.client.create({
            data: {
                refNo: `PH4-V-${Date.now()}`,
                name: "Seed Client PH4",
                mobile: "9999999999",
                tenantId,
                unitId
            }
        });
    }

    // Create a seed enquiry to link historical follow-ups
    const seedEnquiry = await prisma.enquiry.create({
        data: {
            refNo: `PH4-HIST-${Date.now()}`,
            clientId: client.id,
            tenantId,
            unitId,
            status: "CLOSED",
            isConverted: true
        }
    });

    // 1️⃣ SEED HISTORICAL SUCCESS DATA
    console.log("📊 Seeding historical engagement patterns...");

    // Pattern: WhatsApp at 8 PM (20:00) is highly successful
    const historicalEntries = [];
    for (let i = 0; i < 15; i++) {
        const successDate = new Date();
        successDate.setHours(20, 0, 0, 0);

        historicalEntries.push({
            tenantId,
            unitId,
            enquiryId: seedEnquiry.id,
            channel: 'WHATSAPP',
            scheduledAt: successDate,
            response: true,
            converted: i % 2 === 0,
            notes: 'Historical Success'
        });
    }

    // Pattern: Call at 10 AM is also successful but less frequent
    for (let i = 0; i < 5; i++) {
        const successDate = new Date();
        successDate.setHours(10, 0, 0, 0);

        historicalEntries.push({
            tenantId,
            unitId,
            enquiryId: seedEnquiry.id,
            channel: 'CALL',
            scheduledAt: successDate,
            response: true,
            notes: 'Historical Success'
        });
    }

    // Insert Seed Data
    for (const entry of historicalEntries) {
        await (prisma.followUp as any).create({ data: entry });
    }
    console.log(`✅ Seeded ${historicalEntries.length} historical records.`);

    // 2️⃣ TRIGGER NEW HOT LEAD
    console.log("\n🔥 Triggering NEW HOT LEAD...");

    // 🔹 FIX: Create the enquiry in DB first so LeadAgent can link to it
    const newEnquiry = await prisma.enquiry.create({
        data: {
            refNo: `PH4-E-${Date.now()}`,
            clientId: client.id,
            tenantId,
            unitId,
            status: "NEW"
        }
    });

    const decision = await TriggerEngine.processEventAsync({
        tenantId,
        unitId,
        module: "enquiry",
        event: "ENQUIRY_CREATED",
        entityId: newEnquiry.id,
        input: {
            serviceType: "In-House Care",
            comment: "Urgent help needed for elderly father"
        }
    });

    console.log("-----------------------------------------");
    console.log(`🎯 SCORE: ${decision.computed.score} (${decision.computed.label})`);

    // 3️⃣ VERIFY PREDICTION
    const prediction = (decision as any).computed?.prediction;
    if (prediction) {
        console.log(`🔮 PREDICTION: Best Time ${prediction.bestTime} via ${prediction.bestChannel}`);

        if (prediction.bestChannel === 'WHATSAPP' && prediction.bestTime === '20:00') {
            console.log("✅ SUCCESS: FollowUpEngine correctly identified the WhatsApp 8PM pattern!");
        } else {
            console.log("⚠️ WARNING: Prediction mismatch. Check aggregation logic.");
        }
    } else {
        console.log("❌ ERROR: No prediction emitted in decision context.");
    }

    // 4️⃣ VERIFY AUTO-SCHEDULED FOLLOW-UP
    const scheduled = await (prisma.followUp as any).findFirst({
        where: { enquiryId: newEnquiry.id },
        orderBy: { createdAt: 'desc' }
    });

    if (scheduled) {
        console.log(`📅 AUTO-SCHEDULED: ${scheduled.channel} at ${new Date(scheduled.scheduledAt).toLocaleString()}`);
        console.log(`📝 NOTES: ${scheduled.notes}`);
    } else {
        console.log("❌ ERROR: No follow-up scheduled by LeadAgent.");
    }

    console.log("\n🎯 PHASE 4 TEST COMPLETED\n");
    process.exit(0);
}

runPhase4Test().catch(err => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
