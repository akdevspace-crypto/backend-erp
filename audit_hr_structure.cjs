const fs = require('fs');
const path = require('path');

const rootDir = 'F:/ERP';
const frontendHrDir = path.join(rootDir, 'Frontend/src/features/hr');
const backendHrDir = path.join(rootDir, 'Backend/src/modules/hr');
const schemaPath = path.join(rootDir, 'Backend/prisma/schema.prisma');

// 1. Audit Frontend Pages
function auditFrontend() {
    console.log('\n--- FRONTEND HR PAGES ---');
    const pagesDir = path.join(frontendHrDir, 'pages');
    if (fs.existsSync(pagesDir)) {
        fs.readdirSync(pagesDir).forEach(file => {
            console.log(file);
        });
    }
    console.log('\n--- FRONTEND HR HOOKS ---');
    const hooksDir = path.join(frontendHrDir, 'hooks');
    if (fs.existsSync(hooksDir)) {
        fs.readdirSync(hooksDir).forEach(file => {
            console.log(file);
        });
    }
}

// 2. Audit Backend Routes
function auditBackend() {
    console.log('\n--- BACKEND HR ROUTES ---');
    const routesPath = path.join(backendHrDir, 'routes.js');
    if (fs.existsSync(routesPath)) {
        const content = fs.readFileSync(routesPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach(line => {
            if (line.includes('router.') && !line.startsWith('//')) {
                console.log(line.trim());
            }
        });
    }
}

// 3. Audit Prisma Schema
function auditSchema() {
    console.log('\n--- PRISMA SCHEMA HR MODELS ---');
    if (fs.existsSync(schemaPath)) {
        const content = fs.readFileSync(schemaPath, 'utf8');
        const models = ['Staff', 'AttendanceLog', 'LeaveRequest', 'PayrollRecord', 'StaffSalary', 'StaffDocument', 'StaffInterview', 'StaffIncident', 'Task', 'Allocation'];
        models.forEach(model => {
            const regex = new RegExp(`model ${model} \\{[\\s\\S]*?\\}`, 'g');
            const match = content.match(regex);
            if (match) {
                console.log(`\nModel ${model} exists.`);
            } else {
                console.log(`\nModel ${model} DOES NOT EXIST.`);
            }
        });
    }
}

auditFrontend();
auditBackend();
auditSchema();
