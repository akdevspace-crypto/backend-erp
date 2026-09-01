import { prisma } from '../../app/prisma.js';

const WORKFLOW_RULES = {
    ENQUIRY: {
        NEW: ['FOLLOW_UP', 'IN_PROGRESS', 'CLOSED'],
        FOLLOW_UP: ['IN_PROGRESS', 'CLOSED'],
        IN_PROGRESS: ['CLOSED'],
        CLOSED: []
    },
    ALLOCATION: {
        PENDING: ['ALLOCATED', 'ON_HOLD', 'COMPLETED'],
        ALLOCATED: ['ON_HOLD', 'COMPLETED'],
        ON_HOLD: ['ALLOCATED', 'COMPLETED'],
        COMPLETED: []
    },
    ACCOUNT_TRANSACTION: {
        CREATED: ['PENDING_APPROVAL'],
        PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
        APPROVED: ['POSTED'],
        REJECTED: [],
        POSTED: []
    },
    TASK: {
        ASSIGNED: ['IN_PROGRESS'],
        IN_PROGRESS: ['COMPLETED'],
        COMPLETED: ['APPROVED'],
        APPROVED: []
    },
    COMPLAINT: {
        OPEN: ['ASSIGNED', 'RESOLVED', 'CLOSED'],
        ASSIGNED: ['RESOLVED', 'CLOSED'],
        RESOLVED: ['CLOSED'],
        CLOSED: []
    }
};

export const validateTransition = (entityType, currentState, nextState) => {
    const rules = WORKFLOW_RULES[entityType];
    if (!rules) throw new Error(`Unknown entity type for workflow: ${entityType}`);

    const allowedTransitions = rules[currentState];
    if (!allowedTransitions) throw new Error(`Unknown current state: ${currentState}`);

    if (!allowedTransitions.includes(nextState)) {
        throw new Error(`Invalid workflow transition from ${currentState} to ${nextState} for ${entityType}`);
    }

    return true;
};

export const logWorkflow = async (data) => {
    const { entityType, entityId, fromState, toState, actionBy, notes, tenantId, unitId } = data;

    return prisma.workflowLog.create({
        data: {
            entityType,
            entityId,
            fromState,
            toState,
            actionBy,
            notes,
            tenantId,
            unitId
        }
    });
};
