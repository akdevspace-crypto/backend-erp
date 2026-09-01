const fs = require('fs');
const path = require('path');

const pagesDir = 'F:/ERP/Frontend/src/features/hr/pages';

if (fs.existsSync(pagesDir)) {
    const files = fs.readdirSync(pagesDir);
    files.forEach(file => {
        const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
        const hasUseQuery = content.includes('useQuery');
        const hasUseMutation = content.includes('useMutation');
        const hasAxios = content.includes('api.get') || content.includes('api.post') || content.includes('api.put');
        const hasUseHR = content.includes('useHR');
        const usesStaticData = content.includes('mock') || content.includes('dummy') || (content.includes('const [') && !hasUseQuery && !hasUseHR && !hasAxios);
        
        console.log(`\nPage: ${file}`);
        console.log(`- useQuery: ${hasUseQuery}`);
        console.log(`- useMutation: ${hasUseMutation}`);
        console.log(`- API Calls directly: ${hasAxios}`);
        console.log(`- Uses useHR hook: ${hasUseHR}`);
    });
}
