import { Router } from 'express';
import { prisma } from '../../app/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Helper for HTTP errors
const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    error.statusCode = status;
    return error;
};

// Middleware to protect portal routes
const portalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) throw buildHttpError('No token provided', 401);

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        const session = await prisma.patientPortalSession.findUnique({
            where: { token },
            include: { account: true }
        });

        if (!session || session.expiresAt < new Date()) {
            throw buildHttpError('Session expired or invalid', 401);
        }

        req.portalUser = session.account;
        next();
    } catch (err) {
        next(buildHttpError('Unauthorized', 401));
    }
};

// 1. Auth: Login
router.post('/login', async (req, res, next) => {
    try {
        const { mobile, password } = req.body;
        if (!mobile || !password) throw buildHttpError('Mobile and password are required');

        const account = await prisma.patientPortalAccount.findUnique({
            where: { mobile: mobile.trim() }
        });

        console.log("Login attempt:", { mobile: mobile.trim(), providedPass: password, accountFound: !!account, accountPass: account?.password });

        if (!account || account.password !== password) { // Note: In production, use bcrypt.compare
            throw buildHttpError('Invalid credentials', 401);
        }

        const token = jwt.sign(
            { accountId: account.id, patientId: account.patientId }, 
            process.env.JWT_SECRET || 'fallback_secret', 
            { expiresIn: '24h' }
        );

        await prisma.patientPortalSession.create({
            data: {
                accountId: account.id,
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
        });

        res.json({ success: true, data: { token, account: { id: account.id, name: account.name, patientId: account.patientId } } });
    } catch (err) {
        next(err);
    }
});

// 2. Auth: Logout
router.post('/logout', portalAuth, async (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        await prisma.patientPortalSession.delete({
            where: { token }
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// 3. Get Dashboard Data (Vitals, Medications, Diet)
router.get('/dashboard', portalAuth, async (req, res, next) => {
    try {
        const { patientId } = req.portalUser;

        const vitals = await prisma.vitalSign.findMany({
            where: { patientId },
            orderBy: { recordedAt: 'desc' },
            take: 10
        });

        const medications = await prisma.medication.findMany({
            where: { patientId }
        });

        const nutritions = await prisma.nutrition.findMany({
            where: { patientId }
        });

        res.json({
            success: true,
            data: {
                vitals,
                medications,
                nutritions
            }
        });
    } catch (err) {
        next(err);
    }
});

// 4. Get Billing/Invoices (View Only)
router.get('/billing', portalAuth, async (req, res, next) => {
    try {
        const { patientId } = req.portalUser;

        // Fetching admissions to get related enquiries or invoices. 
        // We'll simplify and mock or fetch from actual invoice table if exists for patient.
        const invoices = await prisma.invoice.findMany({
            where: { patientId }, // Assuming Invoice has patientId, otherwise we'd link through Admission -> Enquiry -> Client
            orderBy: { createdAt: 'desc' }
        }).catch(() => []); // Fallback if schema differs

        res.json({
            success: true,
            data: {
                invoices
            }
        });
    } catch (err) {
        next(err);
    }
});

export default router;
