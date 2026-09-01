import * as jwt from 'jsonwebtoken';
import axios from 'axios';

const secret = "supersecretjwtkeyforerpsystem";
// @ts-ignore
const sign = jwt.default?.sign || jwt.sign;

const token = sign({
    id: "test-user-id",
    tenantId: "test-tenant",
    unitId: "test-unit",
    role: "ADMIN"
}, secret);

const API_URL = "http://localhost:3000/api/enquiry";

async function runSimulation() {
    console.log("\n🚀 STARTING E2E API SIMULATION\n");
    try {
        const payload = {
            clientName: "E2E Intelligence Test",
            mobile: "9876543210",
            email: "intel@test.com",
            mode: "Website",
            comments: "URGENT: Patient needs immediate attention. High priority medical case. HOT LEAD!!!",
            unitId: "test-unit"
        };

        console.log("📤 POSTing Enquiry to: " + API_URL);
        const res = await axios.post(API_URL, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const enquiryId = res.data.data.id;
        console.log("✅ Enquiry Created! ID: " + enquiryId);

        console.log("\n⏳ Waiting 5 seconds for Intelligence Engine to score...");
        await new Promise(r => setTimeout(r, 6000));

        console.log("📊 Fetching Intelligence Results...");
        const listRes = await axios.get(API_URL, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const enquiry = listRes.data.data.find((e: any) => e.id === enquiryId);

        if (enquiry && enquiry.automationScores && enquiry.automationScores.length > 0) {
            const scoreObj = enquiry.automationScores[0];
            console.log("\n🎯 --- INTELLIGENCE VERIFIED ---");
            console.log("📍 Lead        : " + enquiry.clientName);
            console.log("🔥 Score       : " + scoreObj.score + "/100");
            console.log("🏷️  Label       : " + scoreObj.label);
            console.log("✅ RESULT      : PASSED");
            console.log("--------------------------------\n");
            process.exit(0);
        } else {
            console.log("\n❌ Intelligence Score Not Found.");
            console.log("Check if worker is running and DB connection is stable.");
            process.exit(1);
        }

    } catch (e: any) {
        console.error("\n❌ SIMULATION FAILED:");
        if (e.response) {
            console.error("Status :", e.response.status);
            console.error("Data   :", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error  :", e.stack || e.message || e);
        }
        process.exit(1);
    }
}

runSimulation();
