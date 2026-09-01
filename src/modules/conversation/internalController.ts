import { prisma } from "../../app/prisma.js";
import { emitRealtimeEvent } from "../../shared/services/socket.js";

export class InternalChatController {
    /**
     * List all staff members for starting a chat
     */
    static async listStaff(req: any, res: any) {
        try {
            const tenantId = req.tenantId || req.user.tenantId;
            const unitId = req.unitId || req.user.unitId;
            console.log(`[InternalChat] Querying for user ${req.user.id}, tenant ${tenantId}, unit ${unitId}`);
            const queryWhere = {
                tenantId,
                ...(unitId && unitId !== 'ALL' ? { unitId } : {}),
                isDeleted: false,
                status: { in: ["Working", "Active", "On Leave"] },
                userId: { not: null }
            };
            console.log(`[InternalChat] Query conditions:`, JSON.stringify(queryWhere));
            const staff = await prisma.staff.findMany({
                where: queryWhere,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    designation: true,
                    department: true,
                    userId: true,
                    photoUrl: true
                }
            });
            console.log(`[InternalChat] listStaff called for user ${req.user.id}, unit ${unitId}. Returned ${staff.length} staff.`);
            res.json({ success: true, data: staff });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get or Create an internal conversation between two users
     */
    static async getOrCreateConversation(req: any, res: any) {
        try {
            const tenantId = req.tenantId || req.user.tenantId;
            const unitId = req.unitId || req.user.unitId;
            const currentUserId = req.user.id;
            const { targetUserId } = req.body;

            if (!targetUserId) {
                return res.status(400).json({ success: false, message: "targetUserId is required" });
            }

            // Internal entities are tracked by a pair of user IDs sorted to ensure uniqueness
            const pair = [currentUserId, targetUserId].sort();
            const entityId = `internal_${pair[0]}_${pair[1]}`;

            let conversation = await prisma.conversation.findFirst({
                where: {
                    tenantId,
                    entityType: "INTERNAL",
                    entityId
                },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        take: 50
                    }
                }
            });

            if (!conversation) {
                conversation = await prisma.conversation.create({
                    data: {
                        tenantId,
                        unitId,
                        entityType: "INTERNAL",
                        entityId,
                        channel: "INTERNAL",
                        status: "OPEN",
                        metadata: { participants: pair }
                    },
                    include: {
                        messages: true
                    }
                }) as any;
            }

            res.json({ success: true, data: conversation });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Send a message in an internal conversation
     */
    static async sendMessage(req: any, res: any) {
        try {
            const tenantId = req.tenantId || req.user.tenantId;
            const unitId = req.unitId || req.user.unitId;
            const currentUserId = req.user.id;
            const currentUserName = req.user.name;
            const { conversationId, body } = req.body;

            if (!conversationId || !body) {
                return res.status(400).json({ success: false, message: "conversationId and body are required" });
            }

            const message = await prisma.message.create({
                data: {
                    tenantId,
                    unitId,
                    conversationId,
                    body,
                    sender: currentUserName || "Staff",
                    direction: "OUTBOUND", // For internal, we'll just use OUTBOUND relative to the sender
                    channel: "INTERNAL",
                    status: "SENT",
                    metadata: { senderId: currentUserId }
                }
            }) as any;

            // Update conversation lastMessageAt
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { lastMessageAt: new Date() }
            });

            // Emit via Socket.io (Redis Adapter will handle propagation) to the chat room
            emitRealtimeEvent(`chat:${conversationId}`, {
                type: 'NEW_MESSAGE',
                tenantId,
                unitId,
                message
            });

            // Emit globally to the recipient user's personal channel for notifications/badges
            const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
            const participants = conversation?.metadata as any;
            if (participants?.participants) {
                const targetUserId = participants.participants.find((id: string) => id !== currentUserId);
                if (targetUserId) {
                    emitRealtimeEvent(`user:${targetUserId}`, {
                        type: 'NEW_INTERNAL_MESSAGE',
                        tenantId,
                        unitId,
                        message,
                        conversationId,
                        senderId: currentUserId,
                        senderName: currentUserName || "Staff"
                    });
                }
            }

            res.json({ success: true, data: message });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
