import { prisma } from "../../../app/prisma.js";
import { generateRefNumber } from "../../../shared/utils/refGenerator.js";

export class ClientService {
    static async getOrCreateByPhone({ mobile, name, email, tenantId, unitId }) {
        let client = await prisma.client.findFirst({
            where: { mobile, tenantId, unitId, isDeleted: false }
        });

        if (!client) {
            const clientRef = await generateRefNumber('CLI', tenantId, unitId);
            client = await prisma.client.create({
                data: {
                    refNo: clientRef,
                    name: name || "WhatsApp Guest",
                    mobile,
                    email,
                    tenantId,
                    unitId
                }
            });
        }

        return client;
    }

    static async getClientById(id, tenantId, unitId) {
        return prisma.client.findFirst({
            where: { id, tenantId, unitId, isDeleted: false }
        });
    }
}
