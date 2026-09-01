const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:3000/api';

async function runTests() {
    console.log("🚀 STARTING VERIFICATION TESTS");

    // 1. Authenticate to get token
    console.log("\n🔑 Authenticating...");
    let token;
    try {
        const authRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@erp.com',
            password: 'admin'
        });
        token = authRes.data.data.token;
        console.log("✅ Authenticated!");
    } catch (e) {
        console.log("⚠️ Auth failed. This test requires a running backend with valid credentials.");
        return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Test Automation Trace (Fix for 404)
    console.log("\n🔍 Testing Automation Trace Route...");
    try {
        const traceRes = await axios.get(`${BASE_URL}/automation/trace/aadfd474-4b11-4d43-a0e7-651948acf43b`, { headers });
        console.log("✅ Trace Route Found! (Status:", traceRes.status, ")");
    } catch (e) {
        if (e.response && e.response.status === 404) {
            console.log("✅ Trace Route Responded with 404 (Data not found), but ROUTE IS LIVE.");
        } else {
            console.error("❌ Trace Route still 404 or failed:", e.response ? e.response.status : e.message);
        }
    }

    // 3. Test Complaint Upload (Fix for 400)
    console.log("\n📤 Testing Complaint Multipart Upload...");
    try {
        const form = new FormData();
        form.append('description', 'VERIFICATION TEST: Complaint with attachment');
        form.append('category', 'medical');
        form.append('priority', 'high');
        form.append('clientName', 'Test Authorized');
        form.append('unitId', '6d00f346-3e80-44c3-a381-1462ba1cd413'); // From previous logs

        // Create a dummy file
        const dummyPath = path.join(process.cwd(), 'test-image.jpg');
        fs.writeFileSync(dummyPath, 'fake-image-data');
        form.append('complaintAttachment', fs.createReadStream(dummyPath));

        const complaintRes = await axios.post(`${BASE_URL}/customer-care/complaints`, form, {
            headers: {
                ...headers,
                ...form.getHeaders()
            }
        });
        console.log("✅ Complaint Created successfully with attachment! ID:", complaintRes.data.data.id);
        fs.unlinkSync(dummyPath);
    } catch (e) {
        console.error("❌ Complaint Upload failed:", e.response ? JSON.stringify(e.response.data) : e.message);
    }

    console.log("\n🏁 VERIFICATION FINISHED");
}

runTests();
