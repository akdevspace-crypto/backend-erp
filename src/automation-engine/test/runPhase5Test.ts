import { TriggerEngine } from "../core/TriggerEngine.js";
import { PrismaClient } from "@prisma/client";
import { prisma } from '../../app/prisma.js';




async function runPhase5Test() {
    console.log("\n🚀 PHASE 5: SMART ALLOCATION TEST STARTED\n");

    const tenantId = "test-tenant";
    const unitId = "test-unit";

    // 0️⃣ PREPARE STAFF DATA
    console.log("👥 Seeding mock staff for allocation...");

    // Cleanup old staff for this test
    await (prisma.staff as any).deleteMany({ where: { empId: { startsWith: 'TEST-STF' } } });

    // Staff A: Expert, Available, Low Workload
    const staffA = await (prisma.staff as any).create({
        data: {
            empId: 'TEST-STF-A',
            firstName: 'Sarah',
            lastName: 'Expert',
            skills: ['In-House Care', 'Physiotherapy'],
            isAvailable: true,
            performanceScore: 95,
            workload: 0,
            tenantId,
            unitId
        }
    });

    // Staff B: Available, High Workload
    const staffB = await (prisma.staff as any).create({
        data: {
            empId: 'TEST-STF-B',
            firstName: 'John',
            lastName: 'Busy',
            skills: ['In-House Care'],
            isAvailable: true,
            performanceScore: 80,
            workload: 10,
            tenantId,
            unitId
        }
    });

    // Staff C: Unavailable
    await (prisma.staff as any).create({
        data: {
            empId: 'TEST-STF-C',
            firstName: 'Emma',
            lastName: 'Offline',
            skills: ['In-House Care'],
            isAvailable: false,
            performanceScore: 100,
            workload: 0,
            tenantId,
            unitId
        }
    });

    console.log("✅ Staff seeded.");

    // 1️⃣ TRIGGER NEW HOT LEAD
    console.log("\n🔥 Triggering NEW HOT LEAD requiring 'In-House Care'...");

    // Create lead entity
    const lead = await prisma.enquiry.create({
        data: {
            refNo: `PH5-E-${Date.now()}`,
            clientId: (await prisma.client.findFirst({ where: { tenantId } }))!.id,
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
        entityId: lead.id,
        input: {
            serviceType: "In-House Care",
            comment: "Need expert Sarah specifically if possible"
        }
    });

    console.log("-----------------------------------------");
    console.log(`🎯 LEAD SCORE: ${decision.computed.score} (${decision.computed.label})`);

    // 2️⃣ VERIFY ALLOCATION
    const allocation = await (prisma.allocation as any).findUnique({
        where: { enquiryId: lead.id }
    });

    if (allocation) {
        const assignedStaff = await (prisma.staff as any).findUnique({ where: { id: allocation.staffId } });
        console.log(`✅ AUTO-ALLOCATED: ${assignedStaff.firstName} ${assignedStaff.lastName}`);
        console.log(`📊 MATCH SCORE: ${allocation.allocationScore}`);

        if (assignedStaff.empId === 'TEST-STF-A') {
            console.log("🏆 SUCCESS: AllocationEngine correctly chose the most qualified, available staff member!");
        } else {
            console.log("⚠️ WARNING: Sub-optimal assignment. Check scoring weights.");
        }

        // 3️⃣ VERIFY WORKLOAD INCREMENT
        const updatedStaffA = await (prisma.staff as any).findUnique({ where: { id: staffA.id } });
        console.log(`📈 UPDATED WORKLOAD (Sarah): ${updatedStaffA.workload}`);
        if (updatedStaffA.workload === 1) {
            console.log("✅ Workload correctly incremented.");
        }
    } else {
        console.log("❌ ERROR: No allocation record found.");
    }

    console.log("\n🎯 PHASE 5 TEST COMPLETED\n");
    process.exit(0);
}

runPhase5Test().catch(err => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
