import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'supersecretjwtkeyforerpsystem';
const payload = {
    id: 'test-id',
    email: 'test@example.com',
    roleId: 'test-role',
    tenantId: 'test-tenant'
};
const token = jwt.sign(payload, secret);

async function run() {
    try {
        console.log("Fetching /api/master/labour-service with test token...");
        const res = await fetch('http://localhost:3000/api/master/labour-service', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: 'LS001',
                type: 'Cleaner',
                rate: 1500,
                agency: 'Internal',
                status: true
            })
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text}`);
    } catch (err) {
        console.error("Fetch error:", err);
    }
}
run();
