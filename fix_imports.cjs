const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            const oldContent = content;

            // Replace `.js` in relative imports (e.g., from "./foo.js", from "../../bar.js")
            content = content.replace(/(from\s+['"]\..*?)(\.js)(['"])/g, '$1$3');

            // Replace `new PrismaClient()` with imported singleton
            if (content.includes('new PrismaClient()')) {
                const alreadyImportsPrisma = content.includes('import { prisma }');

                content = content.replace(/const\s+\w+\s*=\s*new\s+PrismaClient\(\)\;?\n?/g, '');
                content = content.replace(/new\s+PrismaClient\(\)/g, 'prisma');

                if (!alreadyImportsPrisma) {
                    const parsed = path.parse(fullPath);
                    const parts = parsed.dir.split(path.sep);
                    const srcIndex = parts.lastIndexOf('src');
                    if (srcIndex !== -1) {
                        const depth = parts.length - srcIndex - 1;
                        let prefix = '';
                        for (let i = 0; i < depth; i++) prefix += '../';
                        if (prefix === '') prefix = './';
                        const prismaImport = `import { prisma } from '${prefix}app/prisma';\n`;

                        // Insert after the last import if possible
                        const lines = content.split('\n');
                        let lastImportIdx = -1;
                        for (let j = 0; j < lines.length; j++) {
                            if (lines[j].startsWith('import ')) {
                                lastImportIdx = j;
                            }
                        }
                        if (lastImportIdx !== -1) {
                            lines.splice(lastImportIdx + 1, 0, prismaImport);
                            content = lines.join('\n');
                        } else {
                            content = prismaImport + content;
                        }
                    }
                }
            }

            if (content !== oldContent) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

const prismaJsPath = path.resolve('e:/Akash/Web_project/Artibots/ERP_@/Backend/src/app/prisma.js');
if (fs.existsSync(prismaJsPath)) {
    fs.unlinkSync(prismaJsPath);
    console.log('Deleted src/app/prisma.js');
}

processDir('e:/Akash/Web_project/Artibots/ERP_@/Backend/src');
