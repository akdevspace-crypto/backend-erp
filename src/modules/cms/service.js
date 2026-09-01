import { prisma } from '../../app/prisma.js';

export const createBlog = async (tenantId, unitId, authorId, data) => {
    return prisma.blog.create({
        data: {
            ...data,
            tenantId,
            unitId
        }
    });
};

export const getBlogs = async (tenantId, unitId) => {
    return prisma.blog.findMany({
        where: { tenantId, unitId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const updateBlog = async (tenantId, unitId, blogId, data) => {
    return prisma.blog.update({
        where: { id: blogId, tenantId, unitId },
        data: {
            ...data
        }
    });
};

export const deleteBlog = async (tenantId, unitId, blogId) => {
    return prisma.blog.update({
        where: { id: blogId, tenantId, unitId },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
