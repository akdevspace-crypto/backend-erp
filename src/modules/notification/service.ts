import { emitRealtimeEvent } from '../../shared/services/socket.js';
import { prisma } from '../../app/prisma.js';

export interface SendNotificationParams {
    userId?: string;
    role?: string;
    title?: string;
    body?: string;
    message?: string;
    type?: string;
    tenantId: string;
    unitId: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
    targetUrl?: string;
}

export const sendNotification = async (params: SendNotificationParams) => {
    try {
        const title = params.title || params.type || 'Notification';
        const body = params.body || params.message || '';
        
        const notification = await prisma.notification.create({
            data: {
                userId: params.userId || null,
                role: params.role || null,
                title,
                body,
                type: params.type || 'INFO',
                tenantId: params.tenantId,
                unitId: params.unitId,
                entityType: params.entityType || null,
                entityId: params.entityId || null,
                metadata: params.metadata || null,
                isRead: false
            }
        });

        // Emit via Socket.io to specific user or role
        emitRealtimeEvent('notification:new', notification);

        console.log(`[NOTIFICATION - ${notification.type}] To User: ${notification.userId || 'Role: ' + notification.role} | Title: ${notification.title} | Tenant: ${notification.tenantId}`);
        return notification;
    } catch (error) {
        console.error('Notification persistence failed:', error);
        throw error;
    }
};

export const listNotifications = async (user: any) => {
    const rows = await prisma.notification.findMany({
        where: {
            tenantId: user.tenantId,
            isDeleted: false,
            OR: [
                { userId: user.id },
                { role: String(user.role).toUpperCase() }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    return rows;
};

export const markNotificationRead = async (user: any, id: string) => {
    const row = await prisma.notification.findFirst({
        where: {
            id,
            tenantId: user.tenantId,
            isDeleted: false,
            OR: [
                { userId: user.id },
                { role: String(user.role).toUpperCase() }
            ]
        }
    });

    if (!row) {
        const error: any = new Error('Notification not found');
        error.status = 404;
        throw error;
    }

    const updated = await prisma.notification.update({
        where: { id: row.id },
        data: {
            isRead: true
        }
    });

    return updated;
};
