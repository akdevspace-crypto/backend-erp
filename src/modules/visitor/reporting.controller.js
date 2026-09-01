import { prisma } from '../../app/prisma.js';

export const getFacilityVisits = async (req, res) => {
    try {
        const { tenantId, unitId } = req.user;
        const visits = await prisma.facilityVisit.findMany({
            where: { tenantId, unitId, isDeleted: false },
            include: {
                patient: {
                    select: { id: true, firstName: true, lastName: true }
                }
            },
            orderBy: { checkIn: 'desc' }
        });
        res.json({ success: true, data: visits });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createFacilityVisit = async (req, res) => {
    try {
        const { tenantId, unitId } = req.user;
        const { visitorName, contact, patientId, purpose } = req.body;
        const visit = await prisma.facilityVisit.create({
            data: { 
                visitorName, 
                contact, 
                patientId: patientId || null, 
                purpose, 
                tenantId, 
                unitId 
            }
        });
        res.status(201).json({ success: true, data: visit });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
