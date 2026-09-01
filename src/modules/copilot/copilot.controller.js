import { CopilotService } from './copilot.service.js';

export const chatWithCopilot = async (req, res, next) => {
    try {
        const { query } = req.body;
        const { tenantId, unitId, userId } = req.user; // Assumes auth middleware populates req.user

        if (!query) {
            return res.status(400).json({ success: false, error: "Query is required" });
        }

        const result = await CopilotService.chat(query, tenantId, unitId, userId);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};
