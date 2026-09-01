import { createBlog, getBlogs, updateBlog, deleteBlog } from './service.js';
import { success } from '../../shared/utils/response.js';
import { blogSchema } from './schema.js';
import { uploadToSupabase } from '../../shared/utils/supabase.js';

export const handleCreateBlog = async (req, res, next) => {
    try {
        const data = blogSchema.parse(req.body);
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const url = await uploadToSupabase('Erp_software', file);
                imageUrls.push(url);
            }
        }

        const payload = { ...data, images: imageUrls };
        const blog = await createBlog(req.user.tenantId, req.user.unitId, req.user.id, payload);
        return success(res, blog, { message: 'Blog posted successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetBlogs = async (req, res, next) => {
    try {
        const blogs = await getBlogs(req.user.tenantId, req.user.unitId);
        return success(res, blogs);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateBlog = async (req, res, next) => {
    try {
        const data = blogSchema.partial().parse(req.body);
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const url = await uploadToSupabase('Erp_software', file);
                imageUrls.push(url);
            }
        }

        const payload = { ...data };
        if (imageUrls.length > 0) {
            payload.images = imageUrls;
        }

        const blog = await updateBlog(req.user.tenantId, req.user.unitId, req.params.id, payload);
        return success(res, blog, { message: 'Blog updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteBlog = async (req, res, next) => {
    try {
        await deleteBlog(req.user.tenantId, req.user.unitId, req.params.id);
        return success(res, null, { message: 'Blog deleted successfully' });
    } catch (error) {
        next(error);
    }
};
