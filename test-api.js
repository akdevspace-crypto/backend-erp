import jwt from 'jsonwebtoken';
import http from 'http';
import { prisma } from './src/app/prisma.js';

async function test() {
    const user = await prisma.user.findFirst({
        where: { role: { name: { contains: 'Security' } } },
        include: { role: true }
    });
    const patient = await prisma.patient.findFirst({ where: { tenantId: user.tenantId }});

    if (!user || !patient) return console.log("Missing test data");

    const token = jwt.sign({
        id: user.id,
        tenantId: user.tenantId,
        unitId: user.unitId,
        role: user.role.name
    }, 'supersecretjwtkeyforerpsystem');

    const data = JSON.stringify({
        patientId: patient.id,
        reason: 'Medical Appointment',
        destination: 'Hospital',
        expectedReturnAt: '2026-09-02T20:30'
    });

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/security/resident-outings',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => console.log(`STATUS: ${res.statusCode}`, body));
    });
    
    req.on('error', (e) => console.error(e));
    req.write(data);
    req.end();
}

test();
