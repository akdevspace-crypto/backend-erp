import { AIDecisionService } from "./service.js";
// @ts-ignore
import { error, success } from "../../shared/utils/response.js";

const getContext = (req: any) => ({
    tenantId: req.user.tenantId,
    unitId: req.user.unitId,
    userId: req.user.id
});

export const handleScoring = async (req: any, res: any, next: any) => {
    try {
        const result = await AIDecisionService.scoreLead(getContext(req), req.body || {});
        return success(res, result);
    } catch (error) {
        next(error);
    }
};

export const handleNlp = async (req: any, res: any, next: any) => {
    try {
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            return error(res, "Invalid JSON body. Send { message: \"...\" }", 400);
        }

        const { message } = req.body;
        if (!message || typeof message !== "string" || !message.trim()) {
            return error(res, "Message is required", 400);
        }

        const result = await AIDecisionService.analyzeMessage(getContext(req), req.body || {});
        return success(res, result);
    } catch (error) {
        next(error);
    }
};

export const handleAllocation = async (req: any, res: any, next: any) => {
    try {
        const result = await AIDecisionService.allocate(getContext(req), req.body || {});
        return success(res, result);
    } catch (error) {
        next(error);
    }
};
