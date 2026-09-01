const fs = require('fs');
const path = require('path');

const rootDir = 'F:/ERP';
const excludeDirs = ['node_modules', 'dist', 'generated', '.git'];

const patterns = {
    'new Date': /new Date\(/g,
    'toISOString': /\.toISOString\(/g,
    'getFullYear': /\.getFullYear\(/g,
    'getDate': /\.getDate\(/g,
    'setHours': /\.setHours\(/g,
    'Date.UTC': /Date\.UTC\(/g,
    'parseISO': /parseISO\(/g,
    'date-fns': /['"]date-fns['"]/g,
    'moment': /['"]moment['"]/g,
    'Intl.DateTimeFormat': /Intl\.DateTimeFormat/g
};

const results = {};
for (const key in patterns) {
    results[key] = { count: 0, files: new Set() };
}

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (excludeDirs.includes(file)) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const key in patterns) {
                const matches = content.match(patterns[key]);
                if (matches) {
                    results[key].count += matches.length;
                    results[key].files.add(fullPath);
                }
            }
        }
    }
}

scanDir(rootDir);

console.log("--- DATE USAGE AUDIT ---");
for (const key in results) {
    console.log(`${key}: ${results[key].count} occurrences across ${results[key].files.size} files.`);
    if (results[key].files.size > 0 && results[key].files.size <= 5) {
        console.log(`  Found in: ${Array.from(results[key].files).map(f => path.relative(rootDir, f)).join(', ')}`);
    }
}
