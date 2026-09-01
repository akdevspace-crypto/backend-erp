import { Router } from 'express';
import { prisma } from '../../app/prisma.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// GET /api/v1/automation/explain/:entityId
router.get('/explain/:entityId', auth, enforceTenant, async (req: any, res) => {
    try {
        const { entityId } = req.params;

        const score = await (prisma as any).automationScore.findUnique({
            where: { entityId_module: { entityId, module: 'enquiry' } }
        });

        if (!score) {
            return res.status(404).json({ success: false, message: 'No automation score found for this entity' });
        }

        res.json({
            success: true,
            data: {
                score: score.score,
                label: score.label,
                factors: score.factors || [],
                confidence: score.confidence,
                probability: score.probability
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
