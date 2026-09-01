import express from 'express';
import {
    getFundingCategories, createFundingCategory,
    getProjectClassifications, createProjectClassification,
    getProjects, createProject,
    getFundingAllocations, createFundingAllocation,
    getProjectExpenditures, createProjectExpenditure,
    approveExpenditure
} from './controller.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { requireRoles } from '../../shared/middleware/rbac.middleware.js';

const router = express.Router();


router.use(auth);
router.use(enforceTenant);

// Categories & Classifications (Master Data)
router.get('/funding-categories', getFundingCategories);
router.post('/funding-categories', requireRoles(['SUPER_ADMIN']), createFundingCategory);

router.get('/project-classifications', getProjectClassifications);
router.post('/project-classifications', requireRoles(['SUPER_ADMIN']), createProjectClassification);

// Projects
router.get('/projects', getProjects);
router.post('/projects', requireRoles(['SUPER_ADMIN', 'FINANCE_MANAGER']), createProject);

// Funding Allocations
router.get('/funding-allocations', getFundingAllocations);
router.post('/funding-allocations', requireRoles(['SUPER_ADMIN', 'FINANCE_MANAGER']), createFundingAllocation);

// Project Expenditures
router.get('/project-expenditures', getProjectExpenditures);
router.post('/project-expenditures', createProjectExpenditure);
router.patch('/project-expenditures/:id/approve', requireRoles(['SUPER_ADMIN', 'FINANCE_MANAGER']), approveExpenditure);

export default router;
