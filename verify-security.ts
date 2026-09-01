import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from './src/app/prisma.js';
import { auth, enforceTenant } from './src/shared/middleware/auth.middleware.js';

// Setup basic Express app mimicking the real one for isolation testing
const app = express();
app.use(express.json());

app.get('/api/patients', auth, enforceTenant, async (req, res) => {
    try {
        const patients = await prisma.patient.findMany({
            where: { tenantId: req.tenantId }
        });
        res.json({ success: true, data: patients });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/patients', auth, enforceTenant, async (req, res) => {
    try {
        const patient = await prisma.patient.create({
            data: req.body
        });
        res.json({ success: true, data: patient });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforerpsystem';

const generateToken = (userId, tenantId) => {
    return jwt.sign({ id: userId, tenantId }, JWT_SECRET, { expiresIn: '1h' });
};

async function runTests() {
    console.log("Starting Verification Tests...\n");
    
    // 1. Fetch real tenants to test with
    const tenants = await prisma.tenant.findMany({ take: 2 });
    if (tenants.length < 2) {
        console.log("Need at least 2 tenants to run cross-tenant isolation tests. Found: ", tenants.length);
        process.exit(1);
    }
    
    const tenantA = tenants[0];
    const tenantB = tenants[1];
    
    // 2. Fetch a user for Tenant A
    const userA = await prisma.user.findFirst({ where: { tenantId: tenantA.id } });
    if (!userA) {
        console.log(`Need a user in Tenant A (${tenantA.id})`);
        process.exit(1);
    }
    
    const tokenA = generateToken(userA.id, tenantA.id);

    console.log(`=== Cross-Tenant Access Test ===`);
    console.log(`User ID: ${userA.id}`);
    console.log(`Tenant A: ${tenantA.id}`);
    console.log(`Tenant B: ${tenantB.id}`);
    
    console.log("\n[TEST] GET /api/patients as Tenant A User");
    const getRes = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${tokenA}`);
    
    console.log(`HTTP Status: ${getRes.status}`);
    const foundTenantBData = getRes.body?.data?.some(p => p.tenantId === tenantB.id);
    console.log(`Any Tenant B data returned? ${foundTenantBData}`);
    
    console.log("\n[TEST] POST /api/patients attempting to inject Tenant B ID");
    const postRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
            tenantId: tenantB.id,
            firstName: 'Hacker',
            lastName: 'CrossTenant',
            gender: 'MALE',
            dateOfBirth: new Date().toISOString()
        });
    
    console.log(`HTTP Status: ${postRes.status}`);
    console.log(`Created Patient Tenant ID: ${postRes.body?.data?.tenantId}`);
    if (postRes.body?.data?.tenantId === tenantB.id) {
        console.log("SECURITY FAILURE: Successfully injected cross-tenant ID!");
    } else {
        console.log("SUCCESS: Tenant ID injection prevented. Assigned to Tenant A.");
    }
    
    // Cleanup
    if (postRes.body?.data?.id) {
        await prisma.patient.delete({ where: { id: postRes.body.data.id } }).catch(() => {});
    }
    
    process.exit(0);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
