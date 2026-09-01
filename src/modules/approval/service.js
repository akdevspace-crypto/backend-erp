import { prisma } from '../../app/prisma.js';
import { validateTransition } from '../workflow/service.js';
import { emitEvent, EVENTS } from '../event/service.js';

export const requestApproval = async ({ entityType, entityId, tenantId, unitId }) => {
    const approval = await prisma.approval.create({
        data: {
            entityType,
            entityId,
            status: 'PENDING',
            tenantId,
            unitId
        }
    });

    emitEvent(EVENTS.APPROVAL_REQUIRED, { approvalId: approval.id, entityType, entityId, tenantId, unitId });
    return approval;
};

export const processApproval = async ({ approvalId, action, approverId, comments, tenantId }) => {
    if (!['APPROVED', 'REJECTED'].includes(action)) {
        throw new Error('Action must be APPROVED or REJECTED');
    }

    const approval = await prisma.approval.findFirst({
        where: { id: approvalId, tenantId, isDeleted: false }
    });

    if (!approval) throw new Error('Approval not found');
    if (approval.status !== 'PENDING') throw new Error('Approval is already processed');

    // Transaction to update approval and potentially the entity state
    const result = await prisma.$transaction(async (tx) => {
        const updatedApproval = await tx.approval.update({
            where: { id: approvalId },
            data: {
                status: action,
                approverId,
                comments
            }
        });

        // If it's an account transaction
        if (approval.entityType === 'ACCOUNT_TRANSACTION') {
            const transaction = await tx.accountTransaction.findFirst({
                where: { id: approval.entityId }
            });

            if (transaction) {
                // Validate transition
                validateTransition('ACCOUNT_TRANSACTION', transaction.status, action === 'APPROVED' ? 'APPROVED' : 'REJECTED');

                await tx.accountTransaction.update({
                    where: { id: transaction.id },
                    data: { status: action === 'APPROVED' ? 'APPROVED' : 'REJECTED' }
                });
            }
        }

        // Similarly for Tasks etc...

        return updatedApproval;
    });

    return result;
};
