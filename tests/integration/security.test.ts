import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

import { prisma } from '../../src/app/prisma.js';
import { auth, enforceTenant } from '../../src/shared/middleware/auth.middleware.js';
import { requireRoles } from '../../src/shared/middleware/rbac.middleware.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Mock Routes for Testing
app.get('/api/protected', auth, enforceTenant, (req: any, res: any) => {
    res.json({ success: true, tenantId: req.tenantId, unitId: req.unitId, userUnitId: req.user.unitId });
});

app.post('/api/protected', auth, enforceTenant, (req: any, res: any) => {
    res.json({ success: true, body: req.body });
});

app.get('/api/roles', auth, enforceTenant, requireRoles(['MANAGER']), (req: any, res: any) => {
    res.json({ success: true, message: 'Access granted' });
});

describe('Security & Isolation Verification', () => {
    const tenantA = uuidv4();
    const tenantB = uuidv4();
    const unitA = uuidv4();
    const unitB = uuidv4();
    const userA = uuidv4();
    
    const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforerpsystem';
    
    beforeAll(() => {
        // Setup mock user in the mock DB
        jest.spyOn(prisma.user, 'findFirst').mockImplementation((args: any) => {
            const { id, tenantId } = args.where;
            if (id === userA && tenantId === tenantA) {
                return Promise.resolve({
                    id: userA,
                    tenantId: tenantA,
                    unitId: unitA,
                    email: 'test@example.com',
                    firstName: 'Test',
                    isActive: true,
                    updatedAt: new Date(0),
                    role: { name: 'USER' }
                });
            }
            if (id === 'superadmin' && tenantId === tenantA) {
                return Promise.resolve({
                    id: 'superadmin',
                    tenantId: tenantA,
                    unitId: unitA,
                    email: 'admin@example.com',
                    firstName: 'Admin',
                    isActive: true,
                    updatedAt: new Date(0),
                    role: { name: 'SUPER_ADMIN' }
                });
            }
            return Promise.resolve(null);
        });
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    const generateToken = (userId: string, tenantId: string, role = 'USER') => {
        return jwt.sign({ id: userId, tenantId, role }, JWT_SECRET);
    };

    it('Cross-tenant access is rejected', async () => {
        const token = generateToken(userA, tenantB); // Trying to use a different tenantId in token
        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', `Bearer ${token}`);
        
        // Since the user is not found with that tenantId in the DB, it should 401
        expect(res.status).toBe(401);
    });

    it('Cross-unit access is rejected for non-managers (x-unit-id manipulation)', async () => {
        const token = generateToken(userA, tenantA);
        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', `Bearer ${token}`)
            .set('x-unit-id', unitB); // Try to manipulate unit

        // For non-managers, x-unit-id should be ignored and it should fallback to user's unitA
        expect(res.status).toBe(200);
        expect(res.body.unitId).toBe(unitA); 
    });

    it('SUPER_ADMIN has intended global access', async () => {
        const superAdminId = 'superadmin';
        const token = generateToken(superAdminId, tenantA, 'SUPER_ADMIN');
        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', `Bearer ${token}`)
            .set('x-unit-id', unitB); // SuperAdmin manipulating unit is ALLOWED

        expect(res.status).toBe(200);
        expect(res.body.unitId).toBe(unitB); 
    });

    it('Role restrictions are enforced by the backend', async () => {
        const token = generateToken(userA, tenantA);
        const res = await request(app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(403);
    });

    it('tenantId cannot be overridden through request payloads', async () => {
        const token = generateToken(userA, tenantA);
        const maliciousPayload = {
            tenantId: tenantB,
            unitId: unitB,
            data: 'test'
        };

        const res = await request(app)
            .post('/api/protected')
            .set('Authorization', `Bearer ${token}`)
            .send(maliciousPayload);
        
        expect(res.status).toBe(200);
        expect(res.body.body.tenantId).toBe(tenantA); // Overridden to user's tenant
        expect(res.body.body.unitId).toBe(unitA); // Overridden to user's unit (since they are not a manager)
    });
});
