import { 
    getFundingCategories as getFundingCategoriesService, createFundingCategory as createFundingCategoryService, 
    getProjectClassifications as getProjectClassificationsService, createProjectClassification as createProjectClassificationService,
    getProjects as getProjectsService, createProject as createProjectService,
    getFundingAllocations as getFundingAllocationsService, createFundingAllocation as createFundingAllocationService,
    getProjectExpenditures as getProjectExpendituresService, createProjectExpenditure as createProjectExpenditureService,
    approveExpenditure as approveExpenditureService
} from './service.js';
import { 
    createFundingCategorySchema, createProjectClassificationSchema,
    createProjectSchema, createFundingAllocationSchema,
    createProjectExpenditureSchema, approveExpenditureSchema
} from './validation.js';

export const getFundingCategories = async (req: any, res: any) => {
    try {
        const data = await getFundingCategoriesService(req.user.tenantId);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const createFundingCategory = async (req: any, res: any) => {
    try {
        const validated = createFundingCategorySchema.parse(req.body);
        const data = await createFundingCategoryService(req.user.tenantId, req.user.unitId, validated);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const getProjectClassifications = async (req: any, res: any) => {
    try {
        const data = await getProjectClassificationsService(req.user.tenantId);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const createProjectClassification = async (req: any, res: any) => {
    try {
        const validated = createProjectClassificationSchema.parse(req.body);
        const data = await createProjectClassificationService(req.user.tenantId, req.user.unitId, validated);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const getProjects = async (req: any, res: any) => {
    try {
        const data = await getProjectsService(req.user.tenantId);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const createProject = async (req: any, res: any) => {
    try {
        const validated = createProjectSchema.parse(req.body);
        const data = await createProjectService(req.user.tenantId, req.user.unitId, { ...validated, startDate: validated.startDate ? new Date(validated.startDate) : undefined, endDate: validated.endDate ? new Date(validated.endDate) : undefined });
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const getFundingAllocations = async (req: any, res: any) => {
    try {
        const data = await getFundingAllocationsService(req.user.tenantId, req.query.projectId);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const createFundingAllocation = async (req: any, res: any) => {
    try {
        const validated = createFundingAllocationSchema.parse(req.body);
        const data = await createFundingAllocationService(req.user.tenantId, validated);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const getProjectExpenditures = async (req: any, res: any) => {
    try {
        const data = await getProjectExpendituresService(req.user.tenantId, req.query.projectId);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const createProjectExpenditure = async (req: any, res: any) => {
    try {
        const validated = createProjectExpenditureSchema.parse(req.body);
        const data = await createProjectExpenditureService(req.user.tenantId, validated);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export const approveExpenditure = async (req: any, res: any) => {
    try {
        const validated = approveExpenditureSchema.parse(req.body);
        const data = await approveExpenditureService(req.user.tenantId, req.params.id, validated.status, req.user.id);
        res.json({ success: true, data });
    } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}
