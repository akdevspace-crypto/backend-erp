import { v4 as uuidv4 } from "uuid";
import { queue } from "../queue/queue.js";
import { PrismaClient } from "@prisma/client";
import { prisma } from '../../app/prisma.js';




async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullTest() {
    console.log("\n🚀 AUTOMATION TEST STARTED\n");

    const testEvents = [
        {
            name: "🔥 HOT Lead",
            expected: "HOT",
            data: {
                enquiryId: uuidv4(),
                enquiryMode: "Call",
                serviceType: "In-House Care",
                clientComments: "Urgent patient care needed",
                createdAt: new Date().toISOString()
            }
        },
        {
            name: "🟡 WARM Lead",
            expected: "WARM",
            data: {
                enquiryId: uuidv4(),
                enquiryMode: "Website",
                serviceType: "In-House Care",
                clientComments: "Need details",
                createdAt: new Date().toISOString()
            }
        },
        {
            name: "🟢 COLD Lead",
            expected: "COLD",
            data: {
                enquiryId: uuidv4(),
                enquiryMode: "Walk-in",
                serviceType: "Basic",
                clientComments: "Just checking",
                createdAt: new Date().toISOString()
            }
        }
    ];

    const jobMap: any[] = [];

    // ============================================================
    // 1️⃣ PUSH EVENTS
    // ============================================================
    for (const test of testEvents) {
        const eventId = uuidv4();
        const entityId = test.data.enquiryId;

        console.log(`📌 ${test.name}`);

        await prisma.enquiry.upsert({
            where: { refNo: "TEST-" + entityId.substring(0, 8) },
            update: {},
            create: {
                id: entityId,
                refNo: "TEST-" + entityId.substring(0, 8),
                client: {
                    create: {
                        name: "Test Client",
                        mobile: "9999999999-" + entityId.substring(0, 4),
                        refNo: "C-" + entityId.substring(0, 8),
                        tenantId: "test-tenant",
                        unitId: "test-unit"
                    }
                },
                tenantId: "test-tenant",
                unitId: "test-unit"
            }
        });

        await queue.add("process_event", {
            eventId,
            _context: {
                tenantId: "test-tenant",
                unitId: "test-unit",
                userId: "test-user"
            },
            module: "enquiry",
            event: "ENQUIRY_CREATED",
            entityId,
            input: test.data,
            source: "test-suite"
        });

        jobMap.push({
            entityId,
            name: test.name,
            expected: test.expected
        });
    }

    // ============================================================
    // 2️⃣ VERIFY RESULTS
    // ============================================================
    await sleep(5000); // Wait for processing

    const maxRetries = 5;
    for (const job of jobMap) {
        let scoreRecord = null;
        for (let i = 0; i < maxRetries; i++) {
            scoreRecord = await prisma.automationScore.findFirst({
                where: { entityId: job.entityId }
            });
            if (scoreRecord) break;
            await sleep(1000);
        }

        if (!scoreRecord) {
            console.log(`❌ ${job.name} → No score found after ${maxRetries} seconds`);
            continue;
        }

        const status =
            scoreRecord.label === job.expected ? "✅ PASS" : "❌ FAIL";

        console.log(`
${job.name}
-----------------------------------
Score     : ${scoreRecord.score}
Label     : ${scoreRecord.label}
Expected  : ${job.expected}
Result    : ${status}
`);
    }

    console.log("\n🎯 TEST COMPLETED\n");
}

runFullTest()
    .then(() => {
        console.log("✅ All tests executed");
    })
    .catch((err) => {
        console.error("❌ ERROR OCCURRED:");
        console.error(err);
    });