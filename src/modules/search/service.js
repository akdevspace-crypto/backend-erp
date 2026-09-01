import { prisma } from '../../app/prisma.js';

export const globalSearch = async (q, tenantId, unitId) => {
    // Parallel search across major entities to optimize performance
    const [clients, enquiries, tasks] = await Promise.all([
        prisma.client.findMany({
            where: {
                tenantId,
                unitId,
                isDeleted: false,
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { mobile: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                    { refNo: { contains: q, mode: 'insensitive' } }
                ]
            },
            take: 10
        }),
        prisma.enquiry.findMany({
            where: {
                tenantId,
                unitId,
                isDeleted: false,
                OR: [
                    { refNo: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } }
                ]
            },
            include: { client: true },
            take: 10
        }),
        prisma.task.findMany({
            where: {
                tenantId,
                unitId,
                isDeleted: false,
                OR: [
                    { refNo: { contains: q, mode: 'insensitive' } },
                    { title: { contains: q, mode: 'insensitive' } }
                ]
            },
            take: 10
        })
    ]);

    return { clients, enquiries, tasks };
};
