import { prisma } from '../../app/prisma.js';

export const getCampaigns = async (req, res) => {
    try {
        const { tenantId, unitId } = req.user;
        const campaigns = await prisma.marketingCampaign.findMany({
            where: { tenantId, unitId, isDeleted: false },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: campaigns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createCampaign = async (req, res) => {
    try {
        const { tenantId, unitId } = req.user;
        const { title, type, budget, startDate, endDate } = req.body;
        const campaign = await prisma.marketingCampaign.create({
            data: { 
                title, 
                type, 
                budget: Number(budget || 0), 
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                tenantId, 
                unitId 
            }
        });
        res.status(201).json({ success: true, data: campaign });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
