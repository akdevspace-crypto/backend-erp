import { success } from '../../shared/utils/response.js';
import { createUserSchema, updateUserSchema } from './schema.js';
import { createUser, deleteUser, listUsers, updateUser } from './service.js';

export const handleListUsers = async (req, res, next) => {
    try {
        const result = await listUsers(req.user.tenantId);
        return success(res, result);
    } catch (error) {
        next(error);
    }
};

export const handleCreateUser = async (req, res, next) => {
    try {
        const data = createUserSchema.parse(req.body);
        const result = await createUser(req.user.tenantId, data);
        return success(res, result, { message: 'User created successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateUser = async (req, res, next) => {
    try {
        const data = updateUserSchema.parse(req.body);
        const result = await updateUser(req.user.tenantId, req.params.id, data);
        return success(res, result, { message: 'User updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteUser = async (req, res, next) => {
    try {
        await deleteUser(req.user.tenantId, req.params.id, req.user.id);
        return success(res, null, { message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
};
