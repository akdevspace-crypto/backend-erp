export const paginate = ({ page = 1, limit = 10 }) => {
    return {
        skip: (page - 1) * limit,
        take: Number(limit)
    };
};
