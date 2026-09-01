import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function run() {
    try {
        const user = await prisma.user.findFirst();
        
        if (!user) {
            console.log("No user found");
            return;
        }

        const token = jwt.sign({ id: user.id, tenantId: user.tenantId, unitId: user.unitId, role: { name: 'super admin' } }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
        // NOTE: if JWT_SECRET isn't right, the API will reject it with 401. 

        const res = await axios.get('http://localhost:4000/api/v1/accounts/invoice', {
            headers: { 
                'Authorization': 'Bearer ' + token,
                'x-tenant-id': user.tenantId
            }
        });
        
        console.log("API responded with", res.data.data.length, "invoices");
        const manual = res.data.data.filter(i => i.category === 'Manual Billing');
        console.log("Manual invoices in API:", manual.length);
        if (manual.length > 0) {
            console.log(manual[0]);
        }
    } catch(e) {
        console.error("API test failed:", e.response?.data || e.message);
    } finally {
        await prisma.$disconnect();
    }
}
run();
