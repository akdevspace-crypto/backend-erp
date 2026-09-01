import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

async function test() {
    try {
        const payload = {
            id: '8f31d493-4fb3-47a2-8b14-22cb5c643add',
            email: 'normal.security@unisenth.local',
            tenantId: 'f866c6e5-949b-4b6f-a137-0ba659918b34',
            unitId: 'd9d68a07-eb1d-43b7-9dc0-12ac3a5e1c2d',
            role: 'Security Staff',
            iat: Math.floor(Date.now() / 1000)
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        
        console.log("Token generated for Normal Security");
        const res = await axios.get('http://localhost:4000/api/v1/hr/staff?scope=all', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const staffs = res.data.data;
        const unitIds = new Set(staffs.map(s => s.unitId));
        console.log("Unique units found for Normal Security:", Array.from(unitIds));
        
        if (unitIds.size === 1) {
            console.log("SUCCESS: Normal security correctly restricted to single unit.");
        } else {
            console.log("FAILURE: Normal security saw multiple units!", Array.from(unitIds));
        }
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}
test();
