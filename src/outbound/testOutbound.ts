import { sendWhatsAppMessage, sendEmailMessage } from "./outbound.service.js";

async function runTest() {
    try {
        console.log("🚀 Starting Outbound Engine Manual Test...");

        // Import worker dynamically to catch errors during its initialization
        console.log("Loading worker...");
        await import("./worker.runtime.js");
        console.log("Worker loaded.");

        const testContext = {
            tenantId: "test-tenant-id",
            unitId: "test-unit-id",
            conversationId: "test-conversation-id"
        };

        // Test WhatsApp
        console.log("Adding WhatsApp job...");
        await sendWhatsAppMessage({
            messageId: `wa-test-${Date.now()}`,
            phone: "91XXXXXXXXXX",
            message: "Test message from ERP Omnichannel Engine",
            ...testContext
        });

        // Test Email
        console.log("Adding Email job...");
        await sendEmailMessage({
            messageId: `email-test-${Date.now()}`,
            to: "test@example.com",
            subject: "ERP Test",
            text: "This is a test email from the outbound engine.",
            ...testContext
        });

        console.log("✅ Done adding jobs. Worker should process them shortly.");
    } catch (error: any) {
        console.error("❌ Test failed with error:");
        console.error(error);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

runTest().catch((err) => {
    console.error("🔥 Global Catch:", err);
    process.exit(1);
});
