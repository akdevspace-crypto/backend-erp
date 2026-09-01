import fs from 'fs';

const envPath = process.argv[2] || '.env';
const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

const maskValue = (key, value) => {
    if (!value) return '';
    const cleaned = value.replace(/^['"]|['"]$/g, '');
    if (/DATABASE_URL|DIRECT_URL/i.test(key)) {
        try {
            const parsed = new URL(cleaned);
            if (parsed.username) parsed.username = `${parsed.username.slice(0, 3)}***`;
            if (parsed.password) parsed.password = '***';
            return parsed.toString();
        } catch {
            return '[unparseable-url]';
        }
    }
    if (/KEY|SECRET|TOKEN|PASSWORD|PASS/i.test(key)) {
        return cleaned.length <= 8 ? '***' : `${cleaned.slice(0, 4)}***${cleaned.slice(-4)}`;
    }
    return cleaned;
};

const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        return `${key}=${maskValue(key, value)}`;
    });

console.log(rows.join('\n'));
