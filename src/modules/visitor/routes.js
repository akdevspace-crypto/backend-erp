import { Router } from 'express';
import { prisma } from '../../app/prisma.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { requestOtp, verifyOtp } from '../security/otp.service.js';

const router = Router();

const getScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId,
    userId: req.context?.userId || req.user.id
});

// Helper for HTTP errors
const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    error.statusCode = status;
    return error;
};

// 1. Check Profile by Mobile (Autofill)
router.get('/profile/:mobile', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { mobile } = req.params;
        if (!mobile) return res.status(400).json({ error: 'Mobile required' });

        const profile = await prisma.visitorProfile.findUnique({
            where: {
                tenantId_mobile: {
                    tenantId: scope.tenantId,
                    mobile: mobile.trim()
                }
            }
        });

        if (!profile) {
            return res.status(404).json({ success: true, data: null });
        }

        res.json({ success: true, data: profile });
    } catch (err) {
        next(err);
    }
});

// --- OTP Endpoints ---
router.post('/otp/request', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { mobile } = req.body;
        if (!mobile) throw buildHttpError('Mobile number is required');

        const referenceId = await requestOtp({
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            mobile,
            purpose: 'VISITOR_ENTRY',
            requestedBy: scope.userId
        });

        res.json({ success: true, data: { referenceId } });
    } catch (err) {
        next(err);
    }
});

router.post('/otp/verify', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { referenceId, otp } = req.body;
        if (!referenceId || !otp) throw buildHttpError('referenceId and otp are required');

        await verifyOtp({
            tenantId: scope.tenantId,
            referenceId,
            otp
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// 2. Create or Update Visitor Pass
router.post('/pass', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const body = req.body;

        if (!body.mobile || typeof body.mobile !== 'string') {
            throw buildHttpError('Valid mobile number is required');
        }

        // Ensure VisitorProfile exists
        let profile = await prisma.visitorProfile.findUnique({
            where: {
                tenantId_mobile: {
                    tenantId: scope.tenantId,
                    mobile: body.mobile.trim()
                }
            }
        });

        if (profile) {
            // Update profile with latest info
            profile = await prisma.visitorProfile.update({
                where: { id: profile.id },
                data: {
                    name: body.name || profile.name,
                    category: body.category || profile.category,
                    company: body.company || profile.company,
                    photoUrl: body.photoUrl || profile.photoUrl,
                    email: body.email || profile.email,
                    bloodGroup: body.bloodGroup || profile.bloodGroup,
                    residentialAddress: body.residentialAddress || profile.residentialAddress,
                    pincode: body.pincode || profile.pincode
                }
            });
        } else {
            profile = await prisma.visitorProfile.create({
                data: {
                    tenantId: scope.tenantId,
                    mobile: body.mobile.trim(),
                    name: body.name,
                    category: body.category || 'GUEST',
                    company: body.company,
                    photoUrl: body.photoUrl,
                    email: body.email,
                    bloodGroup: body.bloodGroup,
                    residentialAddress: body.residentialAddress,
                    pincode: body.pincode
                }
            });
        }

        const durationHours = parseInt(body.durationHours || 0, 10);
        
        const finalStatus = body.status || 'APPROVED';
        const checkInAt = finalStatus === 'APPROVED' ? (body.checkInAt ? new Date(body.checkInAt) : new Date()) : null;
        const expectedAt = checkInAt && durationHours > 0 ? new Date(checkInAt.getTime() + durationHours * 3600000) : null;

        // Create pass
        const pass = await prisma.visitorPass.create({
            data: {
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                visitorId: profile.id,
                passType: body.passType || 'ONE_TIME',
                purpose: body.purpose,
                department: body.department,
                hostName: body.hostName,
                hostMobile: body.hostMobile,
                vehicleNo: body.vehicleNo,
                materialDetails: body.materialDetails,
                status: finalStatus, // Auto-approve if created by receptionist
                checkInAt,
                expectedAt,
                recordedBy: scope.userId
            }
        });

        res.status(201).json({ success: true, data: { profile, pass } });
    } catch (err) {
        next(err);
    }
});

// 3. Webhook for Google Sheets Integration
router.post('/webhook/google-sheets', async (req, res, next) => {
    try {
        const { tenantId, mobile, name, purpose, hostName } = req.body;

        if (!tenantId || !mobile || !name) {
            return res.status(400).json({ error: 'Missing required fields: tenantId, mobile, name' });
        }

        let profile = await prisma.visitorProfile.findUnique({
            where: {
                tenantId_mobile: {
                    tenantId: tenantId,
                    mobile: mobile.trim()
                }
            }
        });

        if (!profile) {
            profile = await prisma.visitorProfile.create({
                data: {
                    tenantId: tenantId,
                    mobile: mobile.trim(),
                    name: name
                }
            });
        }

        const pass = await prisma.visitorPass.create({
            data: {
                tenantId: tenantId,
                visitorId: profile.id,
                purpose: purpose,
                hostName: hostName,
                status: 'PENDING'
            }
        });

        res.status(201).json({ success: true, data: { passId: pass.id } });
    } catch (err) {
        next(err);
    }
});

// Edit Pass
router.put('/pass/:id', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { id } = req.params;
        const body = req.body;

        const existingPass = await prisma.visitorPass.findFirst({
            where: { id, tenantId: scope.tenantId },
            include: { visitor: true }
        });

        if (!existingPass) return res.status(404).json({ error: 'Pass not found' });

        if (body.name || body.category) {
            await prisma.visitorProfile.update({
                where: { id: existingPass.visitorId },
                data: {
                    name: body.name || existingPass.visitor.name,
                    category: body.category || existingPass.visitor.category,
                }
            });
        }

        const durationHours = parseInt(body.durationHours || 0, 10);
        const expectedAt = existingPass.checkInAt && durationHours > 0 
            ? new Date(existingPass.checkInAt.getTime() + durationHours * 3600000) 
            : existingPass.expectedAt;

        const pass = await prisma.visitorPass.update({
            where: { id },
            data: {
                purpose: body.purpose !== undefined ? body.purpose : existingPass.purpose,
                hostName: body.hostName !== undefined ? body.hostName : existingPass.hostName,
                expectedAt,
            }
        });

        res.json({ success: true, data: pass });
    } catch (err) {
        next(err);
    }
});

// Checkout Pass
router.patch('/pass/:id/checkout', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { id } = req.params;

        const existingPass = await prisma.visitorPass.findFirst({
            where: { id, tenantId: scope.tenantId }
        });

        if (!existingPass) return res.status(404).json({ error: 'Pass not found' });

        if (existingPass.checkOutAt) {
            throw buildHttpError('Visitor is already checked out', 400);
        }

        const pass = await prisma.visitorPass.update({
            where: { id },
            data: {
                checkOutAt: new Date().toISOString()
            }
        });

        res.json({ success: true, data: pass });
    } catch (err) {
        next(err);
    }
});

// Delete Pass
router.delete('/pass/:id', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { id } = req.params;

        await prisma.visitorPass.deleteMany({
            where: { id, tenantId: scope.tenantId }
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// Public Pass Verification
router.get('/verify/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const pass = await prisma.visitorPass.findUnique({
            where: { id },
            include: { visitor: true }
        });

        if (!pass) return res.status(404).json({ error: 'Pass not found or invalid' });

        res.json({ success: true, data: pass });
    } catch (err) {
        next(err);
    }
});

// 4. List Visitor Passes
router.get('/passes', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        
        const passes = await prisma.visitorPass.findMany({
            where: {
                tenantId: scope.tenantId
            },
            include: {
                visitor: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        console.log(`[DEBUG] GET /visitor/passes for tenant ${scope.tenantId} returned ${passes.length} passes.`);

        res.json({ success: true, data: passes });
    } catch (err) {
        next(err);
    }
});

// 5. Visitor Analytics Dashboard
router.get('/analytics', auth, enforceTenant, async (req, res, next) => {
    try {
        const scope = getScope(req);
        
        // Define today's boundaries
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch today's passes
        const todayPasses = await prisma.visitorPass.findMany({
            where: {
                tenantId: scope.tenantId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        const totalVisitorsToday = todayPasses.length;
        const pendingPasses = todayPasses.filter(p => p.status === 'PENDING').length;
        const approvedPasses = todayPasses.filter(p => p.status === 'APPROVED').length;

        // Group by category (we need to join with profile, but for simplicity we can just return the raw stats, or we can fetch profiles)
        const passesWithProfiles = await prisma.visitorPass.findMany({
             where: {
                tenantId: scope.tenantId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: { visitor: true }
        });

        let guestCount = 0;
        let vendorCount = 0;
        let otherCount = 0;

        passesWithProfiles.forEach(p => {
            if (p.visitor?.category === 'GUEST') guestCount++;
            else if (p.visitor?.category === 'VENDOR') vendorCount++;
            else otherCount++;
        });

        // Group by hour for chart
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: `${i}:00`,
            count: 0
        }));

        todayPasses.forEach(p => {
            const hour = new Date(p.createdAt).getHours();
            hourlyData[hour].count++;
        });

        res.json({
            success: true,
            data: {
                totalVisitorsToday,
                pendingPasses,
                approvedPasses,
                guestCount,
                vendorCount,
                otherCount,
                hourlyData
            }
        });

    } catch (err) {
        next(err);
    }
});

export default router;
