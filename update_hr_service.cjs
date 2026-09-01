const fs = require('fs');

let content = fs.readFileSync('src/modules/hr/service.js', 'utf8');

// 1. Remove persistStaffDocuments
const persistStart = content.indexOf('const persistStaffDocuments');
const persistEnd = content.indexOf('const buildMenuPrivilegeMetadata');
content = content.slice(0, persistStart) + content.slice(persistEnd);

// 2. Remove document validation from validateStaffCompliance
const validateStaffComplianceMatch = `const validateStaffCompliance = ({ metadata, files }) => {
    const normalizedMetadata = parseMetadata(metadata);
    const aadhaarNo = normalizeOptionalString(normalizedMetadata.aadhaarNo);

    if (aadhaarNo && !isValidAadhaarNumber(aadhaarNo)) {
        throw buildHttpError('Invalid Aadhaar number. Please provide a valid 12-digit Aadhaar number.');
    }

    const aadhaarDocument = files?.aadhaarDocument?.[0];
    const resumeDocument = files?.resumeDocument?.[0];

    validateStaffDocument(aadhaarDocument, STAFF_DOCUMENT_FIELDS.aadhaarDocument);
    validateStaffDocument(resumeDocument, STAFF_DOCUMENT_FIELDS.resumeDocument);

    if (aadhaarNo && !aadhaarDocument && !normalizedMetadata?.documents?.aadhaarDocument?.fileUrl) {
        throw buildHttpError('Aadhaar document upload is required when Aadhaar number is provided.');
    }
};`;

const validateStaffComplianceReplace = `const validateStaffCompliance = ({ metadata }) => {
    const normalizedMetadata = parseMetadata(metadata);
    const aadhaarNo = normalizeOptionalString(normalizedMetadata.aadhaarNo);

    if (aadhaarNo && !isValidAadhaarNumber(aadhaarNo)) {
        throw buildHttpError('Invalid Aadhaar number. Please provide a valid 12-digit Aadhaar number.');
    }
};`;

content = content.replace(validateStaffComplianceMatch, validateStaffComplianceReplace);

// 3. Add new exports at the end
const newFunctions = `
const uploadStaffDocumentRelational = async ({ tenantId, unitId, staffId, files }) => {
    const documents = [];
    
    // Verify Staff exists
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.tenantId !== tenantId) {
        throw buildHttpError('Staff member not found or unauthorized', 404);
    }
    
    for (const [fieldName, config] of Object.entries(STAFF_DOCUMENT_FIELDS)) {
        const file = files?.[fieldName]?.[0];
        if (!file) continue;
        
        validateStaffDocument(file, config);

        const fileUrl = await uploadToSupabase('Erp_software', file);
        const filePath = \`\${tenantId}/\${unitId}/\${staffId}/\${file.originalname}\`;
        
        const doc = await prisma.staffDocument.create({
            data: {
                staffId,
                tenantId,
                unitId: staff.unitId || unitId,
                documentType: fieldName,
                fileName: file.originalname,
                fileUrl,
                filePath,
                status: fieldName === 'aadhaarDocument' ? 'PENDING_VERIFICATION' : 'UPLOADED'
            }
        });
        documents.push(doc);
    }
    
    return documents;
};

const getStaffDocuments = async (tenantId, unitId, staffId, user) => {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.tenantId !== tenantId) {
        throw buildHttpError('Staff member not found', 404);
    }
    
    const docs = await prisma.staffDocument.findMany({
        where: { staffId, tenantId },
        orderBy: { createdAt: 'desc' }
    });
    return docs;
};

const getDocumentTracker = async (tenantId, unitId, user) => {
    const normalizedRole = String(user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
    const canReadAllUnits = ['admin', 'super admin', 'superadmin', 'hr manager'].includes(normalizedRole);
    
    const where = { tenantId };
    if (!canReadAllUnits && unitId) {
        where.unitId = unitId;
    }
    
    const docs = await prisma.staffDocument.findMany({
        where,
        include: {
            staff: { select: { empId: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    
    return docs.map(doc => ({
        id: doc.id,
        empId: doc.staff?.empId,
        name: \`\${doc.staff?.firstName || ''} \${doc.staff?.lastName || ''}\`.trim(),
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        uploadedAt: doc.uploadedAt,
        status: doc.status
    }));
};
`;

// Insert the new functions just before the export block
const exportBlockIndex = content.lastIndexOf('export {');
content = content.slice(0, exportBlockIndex) + newFunctions + content.slice(exportBlockIndex);

// Update export block
content = content.replace('persistStaffDocuments', 'uploadStaffDocumentRelational, getStaffDocuments, getDocumentTracker');
content = content.replace('validateStaffCompliance({ metadata: data.metadata, files });', 'validateStaffCompliance({ metadata: data.metadata });');
content = content.replace('validateStaffCompliance({ metadata: staff.metadata, files });', 'validateStaffCompliance({ metadata: staff.metadata });');

fs.writeFileSync('src/modules/hr/service.js', content);
console.log('Replacements complete');
