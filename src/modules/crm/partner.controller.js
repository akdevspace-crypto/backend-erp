import { prisma } from '../../app/prisma.js';

export const getPartners = async (req, res) => {
    try {
        const { tenantId, unitId } = req.user;
        const partners = await prisma.referralPartner.findMany({
            where: { tenantId, unitId, isDeleted: false },
            include: { _count: { select: { referrals: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: partners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createPartner = async (req, res) => {
    try {
        const { tenantId, unitId } = req.user;
        const { name, type, contact, email } = req.body;
        const partner = await prisma.referralPartner.create({
            data: { name, type, contact, email, tenantId, unitId }
        });
        res.status(201).json({ success: true, data: partner });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
