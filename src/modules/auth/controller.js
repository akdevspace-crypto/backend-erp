import { loginUser } from './service.js';
import { loginSchema } from './schema.js';
import { success } from '../../shared/utils/response.js';

export const login = async (req, res, next) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const result = await loginUser(validatedData);

        return success(res, result, { message: 'Login successful' });
    } catch (error) {
        next(error);
    }
};
