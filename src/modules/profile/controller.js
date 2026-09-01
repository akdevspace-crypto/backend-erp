import { getProfileInfo } from './service.js';
import { success } from '../../shared/utils/response.js';

export const handleGetProfile = async (req, res, next) => {
    try {
        const profile = await getProfileInfo(req.user.id);
        return success(res, profile, { message: 'Profile fetched successfully' });
    } catch (error) {
        next(error);
    }
};
