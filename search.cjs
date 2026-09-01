const fs = require('fs');
const path = require('path');

function searchFiles(dir, text) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            searchFiles(filePath, text);
        } else if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.includes(text)) {
                console.log(`Found in: ${filePath}`);
            }
        }
    }
}

searchFiles('f:\\ERP\\Backend', 'does not belong to the requested staff member');
