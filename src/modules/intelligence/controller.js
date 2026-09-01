import { prisma } from "../../app/prisma.js";
import { CopilotService } from "../../intelligence/services/copilot.service.js";
import { DashboardService } from "../../intelligence/services/dashboard.service.js";
import { OutboundOrchestratorService } from "../../intelligence/services/outbound-orchestrator.service.js";
import { RevenueForecastService } from "../../intelligence/services/revenue-forecast.service.js";
import { success } from "../../shared/utils/response.js";

export const handleDashboard = async (req, res, next) => {
    try {
        const summary = await DashboardService.getSummary(req.user.tenantId, req.user.unitId);
        return success(res, summary);
    } catch (error) {
        next(error);
    }
};

export const handleCopilotQuery = async (req, res, next) => {
    try {
        const result = await CopilotService.answerQuery(req.body.query, req.user);
        return success(res, result);
    } catch (error) {
        next(error);
    }
};

export const handleBuildForecast = async (req, res, next) => {
    try {
        const forecast = await RevenueForecastService.buildForecast(req.user.tenantId, req.user.unitId, req.body || {});
        return success(res, forecast, { message: "Revenue forecast generated" });
    } catch (error) {
        next(error);
    }
};

export const handleGetForecast = async (req, res, next) => {
    try {
        const forecast = await RevenueForecastService.getLatestForecast(req.user.tenantId, req.user.unitId);
        return success(res, forecast);
    } catch (error) {
        next(error);
    }
};

export const handleCreateTemplate = async (req, res, next) => {
    try {
        const template = await prisma.messageTemplate.create({
            data: {
                tenantId: req.user.tenantId,
                unitId: req.user.unitId,
                ...req.body
            }
        });
        return success(res, template, { message: "Template created" });
    } catch (error) {
        next(error);
    }
};

export const handleListTemplates = async (req, res, next) => {
    try {
        const templates = await prisma.messageTemplate.findMany({
            where: { tenantId: req.user.tenantId, unitId: req.user.unitId },
            orderBy: { updatedAt: "desc" }
        });
        return success(res, templates);
    } catch (error) {
        next(error);
    }
};

export const handleSendOutbound = async (req, res, next) => {
    try {
        const result = await OutboundOrchestratorService.queueMessage({
            tenantId: req.user.tenantId,
            unitId: req.user.unitId,
            ...req.body
        });
        return success(res, result, { message: "Outbound message queued" });
    } catch (error) {
        next(error);
    }
};

export const handleCreateCampaign = async (req, res, next) => {
    try {
        const campaign = await OutboundOrchestratorService.createCampaign({
            tenantId: req.user.tenantId,
            unitId: req.user.unitId,
            ...req.body
        });
        return success(res, campaign, { message: "Campaign created" });
    } catch (error) {
        next(error);
    }
};

export const handleLaunchCampaign = async (req, res, next) => {
    try {
        const campaign = await OutboundOrchestratorService.launchCampaign(req.params.id, req.user.tenantId, req.user.unitId);
        return success(res, campaign, { message: "Campaign launched" });
    } catch (error) {
        next(error);
    }
};
