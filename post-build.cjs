const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            // Fix imports and exports that point to local files
            content = content.replace(/(import|export)\s+(.*?)\s+from\s+['"](\..*?)(?:\.js)?['"]/g, '$1 $2 from \'$3.js\'');

            // Fix side-effect imports
            content = content.replace(/import\s+['"](\..*?)(?:\.js)?['"]/g, 'import \'$1.js\'');

            fs.writeFileSync(fullPath, content);
        }
    }
}

processDir('E:/Akash/Web_project/Artibots/ERP_@/Backend/dist');
console.log('Post-build ESM patch applied to dist/');
