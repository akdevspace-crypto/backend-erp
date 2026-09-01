import fs from 'fs';
import path from 'path';

const modules = [
    {
        name: 'client-service',
        model: 'clientService',
        fields: {
            code: 'z.string().min(2, "Code must be at least 2 characters")',
            name: 'z.string().min(2, "Name must be at least 2 characters")',
            category: 'z.string().min(2, "Category must be at least 2 characters")',
            price: 'z.number().positive("Price must be positive")',
            status: 'z.boolean().optional()'
        }
    },
    {
        name: 'department',
        model: 'department',
        fields: {
            code: 'z.string().min(2, "Code must be at least 2 characters")',
            name: 'z.string().min(2, "Name must be at least 2 characters")',
            head: 'z.string().optional().nullable()',
            totalStaff: 'z.number().min(0).optional()',
            status: 'z.boolean().optional()'
        }
    },
    {
        name: 'labour-service',
        model: 'labourService',
        fields: {
            code: 'z.string().min(2, "Code must be at least 2 characters")',
            type: 'z.string().min(2, "Type must be at least 2 characters")',
            rate: 'z.number().positive("Rate must be positive")',
            agency: 'z.string().optional().nullable()',
            status: 'z.boolean().optional()'
        }
    },
    {
        name: 'payment-category',
        model: 'paymentCategory',
        fields: {
            code: 'z.string().min(2, "Code must be at least 2 characters")',
            name: 'z.string().min(2, "Name must be at least 2 characters")',
            type: 'z.enum(["INCOME", "EXPENSE"])',
            description: 'z.string().optional().nullable()',
            status: 'z.boolean().optional()'
        }
    },
    {
        name: 'vendor',
        model: 'vendor',
        fields: {
            code: 'z.string().min(2, "Code must be at least 2 characters")',
            name: 'z.string().min(2, "Name must be at least 2 characters")',
            category: 'z.string().min(2, "Category must be at least 2 characters")',
            contact: 'z.string().optional().nullable()',
            status: 'z.boolean().optional()'
        }
    },
    {
        name: 'room',
        model: 'room',
        fields: {
            code: 'z.string().min(2, "Code must be at least 2 characters")',
            type: 'z.string().min(2, "Type must be at least 2 characters")',
            capacity: 'z.number().int().min(1, "Capacity must be at least 1")',
            status: 'z.boolean().optional()'
        }
    }
];

const basePath = path.join('e:/Akash/Web_project/Artibots/ERP_@/Backend/src/modules/master');

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function kebabToCamel(string) {
    return string.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
}

modules.forEach(mod => {
    const modDir = path.join(basePath, mod.name);
    if (!fs.existsSync(modDir)) {
        fs.mkdirSync(modDir, { recursive: true });
    }

    const camelName = kebabToCamel(mod.name);
    const pascalName = capitalizeFirstLetter(camelName);

    // schema.js
    const schemaContent = `import { z } from 'zod';

export const ${camelName}Schema = z.object({
${Object.entries(mod.fields).map(([k, v]) => `    ${k}: ${v}`).join(',\n')}
});
`;
    fs.writeFileSync(path.join(modDir, 'schema.js'), schemaContent);

    // service.js
    const serviceContent = `import { prisma } from '../../../app/prisma.js';
import { AppError } from '../../../shared/utils/response.js';

export const create${pascalName} = async (data, unitId, tenantId) => {
    return await prisma.${mod.model}.create({
        data: {
            ...data,
            unitId,
            tenantId
        }
    });
};

export const get${pascalName}s = async (unitId, tenantId) => {
    return await prisma.${mod.model}.findMany({
        where: { unitId, tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const get${pascalName}ById = async (id, unitId, tenantId) => {
    const record = await prisma.${mod.model}.findFirst({
        where: { id, unitId, tenantId, isDeleted: false }
    });
    if (!record) throw new AppError('${pascalName} not found', 404);
    return record;
};

export const update${pascalName} = async (id, data, unitId, tenantId) => {
    await get${pascalName}ById(id, unitId, tenantId); // ensure exists
    return await prisma.${mod.model}.update({
        where: { id },
        data
    });
};

export const delete${pascalName} = async (id, unitId, tenantId) => {
    await get${pascalName}ById(id, unitId, tenantId); // ensure exists
    return await prisma.${mod.model}.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
`;
    fs.writeFileSync(path.join(modDir, 'service.js'), serviceContent);

    // controller.js
    const controllerContent = `import { successResponse } from '../../../shared/utils/response.js';
import { ${camelName}Schema } from './schema.js';
import * as ${camelName}Service from './service.js';

export const handleCreate${pascalName} = async (req, res, next) => {
    try {
        const data = ${camelName}Schema.parse(req.body);
        const record = await ${camelName}Service.create${pascalName}(data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, '${pascalName} created successfully', 201);
    } catch (error) {
        next(error);
    }
};

export const handleGet${pascalName}s = async (req, res, next) => {
    try {
        const records = await ${camelName}Service.get${pascalName}s(req.user.unitId, req.user.tenantId);
        return successResponse(res, records, '${pascalName}s retrieved successfully');
    } catch (error) {
        next(error);
    }
};

export const handleUpdate${pascalName} = async (req, res, next) => {
    try {
        const data = ${camelName}Schema.partial().parse(req.body);
        const record = await ${camelName}Service.update${pascalName}(req.params.id, data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, '${pascalName} updated successfully');
    } catch (error) {
        next(error);
    }
};

export const handleDelete${pascalName} = async (req, res, next) => {
    try {
        await ${camelName}Service.delete${pascalName}(req.params.id, req.user.unitId, req.user.tenantId);
        return successResponse(res, null, '${pascalName} deleted successfully');
    } catch (error) {
        next(error);
    }
};
`;
    fs.writeFileSync(path.join(modDir, 'controller.js'), controllerContent);

    // routes.js
    const routesContent = `import { Router } from 'express';
import { handleCreate${pascalName}, handleGet${pascalName}s, handleUpdate${pascalName}, handleDelete${pascalName} } from './controller.js';

const router = Router();

router.post('/', handleCreate${pascalName});
router.get('/', handleGet${pascalName}s);
router.put('/:id', handleUpdate${pascalName});
router.delete('/:id', handleDelete${pascalName});

export default router;
`;
    fs.writeFileSync(path.join(modDir, 'routes.js'), routesContent);

});

console.log('Successfully generated all master modules.');
