import { Router } from 'express';
import { prisma } from '../../app/prisma.js';
import { protect as auth } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

function generateReceiptNo(count: number): string {
    return `UNCF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

router.get('/', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const tenantId = req.user.tenantId;
        const donations = await prisma.donation.findMany({
            where: {
                tenantId,
                isDeleted: false
            },
            include: {
                donor: true
            },
            orderBy: {
                date: 'desc'
            }
        });
        res.json({ success: true, data: donations });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/:id', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const tenantId = req.user.tenantId;
        const donation = await prisma.donation.findFirst({
            where: {
                id: req.params.id,
                tenantId,
                isDeleted: false
            },
            include: {
                donor: true,
                references: true
            }
        });
        if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });
        res.json({ success: true, data: donation });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const tenantId = req.user.tenantId;
        const unitId = req.user.unitId || null;
        const body = req.body;

        const result = await (prisma as any).$transaction(async (tx: any) => {
            let donor = null;
            if (body.donorId) {
                donor = await tx.donor.findFirst({ where: { id: body.donorId, tenantId } });
            } else if (body.mobile) {
                donor = await tx.donor.findFirst({ where: { mobile: body.mobile, tenantId } });
            }

            if (!donor) {
                const donorCount = await tx.donor.count({ where: { tenantId } });
                donor = await tx.donor.create({
                    data: {
                        tenantId,
                        unitId,
                        donorNo: `DNR-${new Date().getFullYear()}-${String(donorCount + 1).padStart(4, '0')}`,
                        name: body.name || 'Anonymous',
                        fatherOrHusbandName: body.fatherOrHusbandName || null,
                        residentialAddress: body.residentialAddress || null,
                        permanentAddress: body.permanentAddress || null,
                        mobile: body.mobile || null,
                        whatsappNumber: body.whatsappNumber || null,
                        email: body.email || null,
                        panNumber: body.panNumber || null,
                        dob: body.dob ? new Date(body.dob) : null,
                        isCorporate: body.isCorporate === true,
                        createdBy: req.user.id
                    }
                });
            } else {
                // Update donor info if newer info is provided
                donor = await tx.donor.update({
                    where: { id: donor.id },
                    data: {
                        fatherOrHusbandName: body.fatherOrHusbandName || donor.fatherOrHusbandName,
                        residentialAddress: body.residentialAddress || donor.residentialAddress,
                        permanentAddress: body.permanentAddress || donor.permanentAddress,
                        whatsappNumber: body.whatsappNumber || donor.whatsappNumber,
                        email: body.email || donor.email,
                        panNumber: body.panNumber || donor.panNumber,
                        isCorporate: body.isCorporate ?? donor.isCorporate
                    }
                });
            }

            const receiptCount = await tx.donation.count({ where: { tenantId } });
            const donation = await tx.donation.create({
                data: {
                    tenantId,
                    unitId,
                    donorId: donor.id,
                    receiptNo: generateReceiptNo(receiptCount),
                    amount: Number(body.amount || 0),
                    amountInWords: body.amountInWords || null,
                    paymentMode: body.paymentMode || 'CASH',
                    materialDetails: body.materialDetails || null,
                    category: body.category || null,
                    purpose: body.purpose || null,
                    occasionName: body.occasionName || null,
                    occasionRelation: body.occasionRelation || null,
                    occasionDate: body.occasionDate ? new Date(body.occasionDate) : null,
                    occasionMobile: body.occasionMobile || null,
                    recurringPlan: body.recurringPlan || null,
                    preferredPrayerDate: body.preferredPrayerDate ? new Date(body.preferredPrayerDate) : null,
                    honouredPersonImage: body.honouredPersonImage || null,
                    specialPrayerMessage: body.specialPrayerMessage || null,
                    wishToVisitHome: body.wishToVisitHome === true,
                    preferredVisitDate: body.preferredVisitDate ? new Date(body.preferredVisitDate) : null,
                    taxDeduction: body.taxDeduction === true,
                    receivedBy: body.receivedBy || req.user.name,
                    verifiedBy: body.verifiedBy || null,
                    createdBy: req.user.id
                }
            });

            if (body.references && Array.isArray(body.references)) {
                for (const ref of body.references) {
                    if (ref.name) {
                        await tx.donationReference.create({
                            data: {
                                tenantId,
                                donationId: donation.id,
                                name: ref.name,
                                mobile: ref.mobile || null
                            }
                        });
                    }
                }
            }

            return await tx.donation.findUnique({
                where: { id: donation.id },
                include: { donor: true, references: true }
            });
        });

        res.json({ success: true, data: result, message: 'Donation recorded successfully' });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.patch('/:id/mark-sent', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const tenantId = req.user.tenantId;
        const donation = await prisma.donation.updateMany({
            where: {
                id: req.params.id,
                tenantId
            },
            data: {
                isReceiptSent: true,
                receiptSentAt: new Date()
            }
        });
        
        if (donation.count === 0) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }
        
        res.json({ success: true, message: 'Receipt marked as sent' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
