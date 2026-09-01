import { createCity, getCities, updateCity, deleteCity } from './service.js';
import { success } from '../../../shared/utils/response.js';
import { citySchema } from './schema.js';

export const handleCreateCity = async (req, res, next) => {
    try {
        const data = citySchema.parse(req.body);
        const city = await createCity(req.user.tenantId, req.user.unitId, data);
        return success(res, city, { message: 'City created successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetCities = async (req, res, next) => {
    try {
        const cities = await getCities(req.user.tenantId, req.user.unitId);
        return success(res, cities);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateCity = async (req, res, next) => {
    try {
        const data = citySchema.parse(req.body);
        const city = await updateCity(req.params.id, req.user.tenantId, req.user.unitId, data);
        return success(res, city, { message: 'City updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteCity = async (req, res, next) => {
    try {
        await deleteCity(req.params.id, req.user.tenantId, req.user.unitId);
        return success(res, null, { message: 'City deleted successfully' });
    } catch (error) {
        next(error);
    }
};
