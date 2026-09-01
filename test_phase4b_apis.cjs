const jwt = require('jsonwebtoken');

// Load environment variables directly if needed, or just use a known one if we have it
require('dotenv').config({ path: 'd:/ERP/backend/.env' });

const JWT_SECRET = process.env.JWT_SECRET || 'antigravity-erp-secret-key-2024';

function generateToken(tenantId, role) {
    return jwt.sign({
        id: 'test-user-id',
        tenantId: tenantId,
        role: role,
        email: 'test@example.com'
    }, JWT_SECRET);
}

async function apiGet(path, headers) {
    const res = await fetch(`http://localhost:4000/api/v1${path}`, { headers });
    let data = null;
    try { data = await res.json(); } catch (e) { }
    return { status: res.status, data };
}

async function runTests() {

    // 1. Get a test tenant and unit (using existing endpoints or just Prisma)
    const { PrismaClient } = require('d:/ERP/backend/node_modules/@prisma/client');
    const prisma = new PrismaClient();

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.log("No tenant found.");
        return;
    }
    const unit = await prisma.unit.findFirst({ where: { tenantId: tenant.id } });
    const unitId = unit ? unit.id : 'ALL';

    let patients = await prisma.patient.findMany({
        where: { tenantId: tenant.id },
        take: 2
    });

    if (patients.length < 2) {
        console.log("Creating dummy test patients...");
        await prisma.patient.create({ data: { id: 'test-patient-a', tenantId: tenant.id, unitId, name: 'Test Patient A' } });
        await prisma.patient.create({ data: { id: 'test-patient-b', tenantId: tenant.id, unitId, name: 'Test Patient B' } });

        patients = await prisma.patient.findMany({
            where: { tenantId: tenant.id },
            take: 2
        });
    }

    const patientA = patients[0].id;
    const patientB = patients[1].id;

    console.log(`Testing with Tenant: ${tenant.id}, Unit: ${unitId}`);
    console.log(`Patient A: ${patientA}`);
    console.log(`Patient B: ${patientB}`);

    const token = generateToken(tenant.id, 'NURSE');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'x-unit-id': unitId
    };

    console.log('\n--- 8. MEDICATION FILTERING TEST ---');
    const medA = await apiGet(`/medication-schedules?patientId=${patientA}`, headers);
    console.log(`GET /medication-schedules?patientId=${patientA} -> Status: ${medA.status}, Results: ${medA.data?.data?.length}`);

    const medB = await apiGet(`/medication-schedules?patientId=${patientB}`, headers);
    console.log(`GET /medication-schedules?patientId=${patientB} -> Status: ${medB.status}, Results: ${medB.data?.data?.length}`);

    // Verify isolation - ensure medA has no patientB records (if any exist)
    const medAHasB = medA.data?.data?.some(m => m.payload?.patientId === patientB);
    console.log(`medA contains patientB's data? ${medAHasB}`);

    console.log('\n--- 9. STOCK ISSUE FILTERING TEST ---');
    const stockA = await apiGet(`/stock/issue-requests?patientId=${patientA}`, headers);
    console.log(`GET /stock/issue-requests?patientId=${patientA} -> Status: ${stockA.status}, Results: ${stockA.data?.data?.length}`);

    const stockB = await apiGet(`/stock/issue-requests?patientId=${patientB}`, headers);
    console.log(`GET /stock/issue-requests?patientId=${patientB} -> Status: ${stockB.status}, Results: ${stockB.data?.data?.length}`);

    const stockAHasB = stockA.data?.data?.some(s => s.patientId === patientB);
    console.log(`stockA contains patientB's data? ${stockAHasB}`);

    console.log('\n--- 7. TENANT SECURITY TEST ---');
    // Try to access patientA using a different tenant token
    const wrongTenantToken = generateToken('different-tenant-id', 'NURSE');
    const wrongTenantHeaders = {
        'Authorization': `Bearer ${wrongTenantToken}`,
        'x-unit-id': unitId
    };

    const stockWrongTenant = await apiGet(`/stock/issue-requests?patientId=${patientA}`, wrongTenantHeaders);
    console.log(`Access patientA from wrong tenant -> Status: ${stockWrongTenant.status}, Results: ${stockWrongTenant.data?.data?.length || 0}`);

    console.log('\n--- TESTS COMPLETED ---');
    process.exit(0);
}

runTests().catch(console.error);
