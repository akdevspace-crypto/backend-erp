import { success } from '../../shared/utils/response.js';
import { createLocationSchema, locationSearchSchema } from './schema.js';
import { createLocation, searchLocations } from './service.js';

export const handleSearchLocations = async (req, res, next) => {
    try {
        const { q } = locationSearchSchema.parse(req.query);
        const locations = await searchLocations(q);
        return success(res, locations);
    } catch (error) {
        next(error);
    }
};

export const handleCreateLocation = async (req, res, next) => {
    try {
        const data = createLocationSchema.parse(req.body);
        const location = await createLocation(data);
        return success(res, location, { message: 'Location created successfully' }, 201);
    } catch (error) {
        next(error);
    }
};
