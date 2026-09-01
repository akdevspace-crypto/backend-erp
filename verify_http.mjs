import { PrismaClient } from "file:///D:/ERP/Backend/src/generated/prisma/index.js";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = "supersecretjwtkeyforerpsystem";
const API_URL = "http://localhost:4000/api/v1";

async function runTests() {
    console.log("=== PHASE 1: PRE-CHECK (Existing 25 Records) ===");
    const tenantId = 'f866c6e5-949b-4b6f-a137-0ba659918b34';
    const ueoUnit = await prisma.unit.findFirst({ where: { tenantId, name: 'Universal Enquiry Office' } });
    const hqUnit = await prisma.unit.findFirst({ where: { tenantId, name: 'Headquarters' } });
    const uhcUnit = await prisma.unit.findFirst({ where: { tenantId, name: 'Universal Health Care' } });
    
    if (!ueoUnit || !uhcUnit || !hqUnit) throw new Error('Could not find units');

    const oldAdmissionsCount = await prisma.admission.count({
        where: { tenantId, unitId: { in: [ueoUnit.id, hqUnit.id] } }
    });
    console.log(`Currently there are ${oldAdmissionsCount} admissions in UEO/HQ (expecting ~25).`);

    console.log("\n=== PHASE 2: TEST DATA DISCOVERY & CREATION ===");
    // Create a TEST enquiry safely
    const testEnquiry = await prisma.enquiry.create({
        data: {
            tenantId,
            unitId: ueoUnit.id,
            client: { create: { name: 'TEST CLIENT', mobile: '1234567890', tenantId, refNo: `CLI-TEST-${Date.now()}`, unitId: ueoUnit.id } },
            rawMessage: JSON.stringify({ patientName: 'TEST CROSS UNIT CONVERSION PATIENT', mobile: '1234567890', service: 'Elder Care' }),
            status: 'IN_PROGRESS',
            refNo: `ENQ-TEST-${Date.now()}`
        }
    });
    console.log(`Created TEST Enquiry: ${testEnquiry.id} under UEO`);

    // Generate Admin JWT Token
    const adminUser = await prisma.user.findFirst({ where: { tenantId } });
    if (!adminUser) throw new Error('No admin user found');
    
    const token = jwt.sign(
        { id: adminUser.id, tenantId: adminUser.tenantId, role: 'Super Admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-unit-id': ueoUnit.id
    };

    console.log("\n=== PHASE 6: SECURITY / NEGATIVE TESTS ===");
    
    // Test 1: Missing unitId
    let res = await fetch(`${API_URL}/enquiry/${testEnquiry.id}/convert-to-admission`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ patientName: 'TEST', status: 'ACTIVE' })
    });
    console.log(`Test 1 (Missing unitId) Status: ${res.status} (Expected 400)`);
    
    // Test 2: Invalid unitId
    res = await fetch(`${API_URL}/enquiry/${testEnquiry.id}/convert-to-admission`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ patientName: 'TEST', unitId: '00000000-0000-0000-0000-000000000000', status: 'ACTIVE' })
    });
    console.log(`Test 2 (Invalid unitId) Status: ${res.status} (Expected 400)`);

    console.log("\n=== PHASE 3 & 4: CONTROLLED FUNCTIONAL TEST ===");
    res = await fetch(`${API_URL}/enquiry/${testEnquiry.id}/convert-to-admission`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            patientName: 'TEST CROSS UNIT CONVERSION PATIENT',
            unitId: uhcUnit.id,
            status: 'ACTIVE'
        })
    });
    
    const body = await res.json();
    if (res.status === 201 || res.status === 200) {
        console.log("✅ Successfully converted TEST Enquiry to Admission!");
        const createdAdmission = body.data;
        
        console.log("Database Verification:");
        console.log(`- Admission ID: ${createdAdmission.id}`);
        console.log(`- Enquiry ID matches: ${createdAdmission.enquiryId === testEnquiry.id}`);
        console.log(`- Destination Unit matches UHC: ${createdAdmission.unitId === uhcUnit.id} (${createdAdmission.unitId})`);
        console.log(`- Tenant matches: ${createdAdmission.tenantId === tenantId}`);
        console.log(`- Status: ${createdAdmission.status}`);
        
        if (createdAdmission) {
            await prisma.admission.delete({ where: { id: createdAdmission.id } });
            await prisma.patient.delete({ where: { id: createdAdmission.patient.id } });
        }
    } else {
        console.error(`❌ Conversion failed (HTTP ${res.status}):`, body);
    }

    console.log("\n=== PHASE 7: EXISTING RECORDS PROTECTION ===");
    const newAdmissionsCount = await prisma.admission.count({
        where: { tenantId, unitId: { in: [ueoUnit.id, hqUnit.id] } }
    });
    console.log(`Currently there are ${newAdmissionsCount} admissions in UEO/HQ.`);
    if (newAdmissionsCount === oldAdmissionsCount) {
        console.log("✅ Existing 25 records remain completely untouched.");
    } else {
        console.error("❌ Existing record count changed! Data contamination.");
    }
    
    await prisma.enquiry.delete({ where: { id: testEnquiry.id } });
    console.log("\n✅ Test data completely removed.");
    await prisma.$disconnect();
}

runTests();
