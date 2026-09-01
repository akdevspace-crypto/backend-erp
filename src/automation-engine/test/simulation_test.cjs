const jwt = require('jsonwebtoken');
const axios = require('axios');

const secret = "supersecretjwtkeyforerpsystem";
const token = jwt.sign({
    id: "fd4b67d6-e6f0-410b-aff4-1dd4c5a67755", // Real Admin User ID
    tenantId: "fc75cbca-5a45-46e9-9905-521d708e5ebe",
    roleId: "7b04a594-1ea7-4c23-a731-8e322e1c8460",
    unitId: "6d00f346-3e80-44c3-a381-1462ba1cd413",
    role: "Admin"
}, secret);

const API_URL = "http://127.0.0.1:3000/api/enquiry";

async function runSimulation() {
    console.log("\n🚀 STARTING REAL E2E API SIMULATION (v3)\n");
    try {
        const payload = {
            clientName: "Intelligence Test - Authorized " + Date.now(),
            mobile: "9100000000",
            email: "authorized@test.com",
            mode: "Website",
            comments: "URGENT: Patient needs immediate attention. High priority medical case. HOT LEAD!!!",
            unitId: "6d00f346-3e80-44c3-a381-1462ba1cd413"
        };

        console.log("📤 POSTing Enquiry payload to " + API_URL);
        let res;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                res = await axios.post(API_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                break;
            } catch (err) {
                if (attempt === 3) throw err;
                console.log(`⚠️ POST failed (attempt ${attempt}), retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const enquiryId = res.data.data.id;
        console.log("✅ Enquiry Created! ID: " + enquiryId);

        console.log("\n⏳ Waiting 10 seconds for Intelligence Engine to score...");
        await new Promise(r => setTimeout(r, 10000));

        console.log("📊 Fetching Intelligence Results...");
        let listRes;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                listRes = await axios.get(API_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                break;
            } catch (err) {
                if (attempt === 3) throw err;
                console.log(`⚠️ GET failed (attempt ${attempt}), retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const enquiryList = listRes.data.data;
        const enquiry = enquiryList.find((e) => e.id === enquiryId);

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
            console.log("\n❌ Intelligence Score Not Found for ID: " + enquiryId);
            console.log("Check Worker output and ScoreEngine logs.");
            process.exit(1);
        }

    } catch (e) {
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
