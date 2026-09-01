import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../src/generated/prisma/index.js';

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node scripts/apply-sql-file.mjs <sql-file>');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), fileArg);
const sql = fs.readFileSync(sqlPath, 'utf8');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

const splitSqlStatements = (source) => {
  const statements = [];
  let current = '';
  let singleQuoted = false;
  let doubleQuoted = false;
  let dollarTag = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (!singleQuoted && !doubleQuoted && !dollarTag && char === '-' && next === '-') {
      while (i < source.length && source[i] !== '\n') i += 1;
      current += '\n';
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === '$') {
      const match = source.slice(i).match(/^\$[A-Za-z_0-9]*\$/);
      if (match) {
        const tag = match[0];
        current += tag;
        i += tag.length - 1;
        dollarTag = dollarTag === tag ? null : (dollarTag || tag);
        continue;
      }
    }

    if (!dollarTag && char === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
    } else if (!dollarTag && char === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
    }

    if (char === ';' && !singleQuoted && !doubleQuoted && !dollarTag) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
};

try {
  const statements = splitSqlStatements(sql);
  console.log(`Applying ${statements.length} SQL statements from ${path.relative(process.cwd(), sqlPath)}`);

  for (let index = 0; index < statements.length; index += 1) {
    await prisma.$executeRawUnsafe(statements[index]);
    console.log(`[ok] ${index + 1}/${statements.length}`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
