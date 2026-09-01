import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/index.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
const directUrl = process.env.DIRECT_URL?.trim();
const preferredPoolerHost = process.env.SUPABASE_POOLER_HOST?.trim();

const envInfo = {
  DATABASE_URL: databaseUrl,
  DIRECT_URL: directUrl,
  SUPABASE_POOLER_HOST: preferredPoolerHost,
};

console.log('envInfo=', envInfo);

const buildPrismaClientOptions = () => {
  if (!databaseUrl) return {};

  let parsedDatabaseUrl;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    return {};
  }

  const isPoolerHost = /\.pooler\.supabase\.com$/i.test(parsedDatabaseUrl.hostname);
  const useDirectUrl = isPoolerHost && !!directUrl;
  const activeDatabaseUrl = useDirectUrl ? directUrl : databaseUrl;

  console.log('isPoolerHost=', isPoolerHost, 'useDirectUrl=', useDirectUrl, 'activeDatabaseUrl=', activeDatabaseUrl);

  try {
    const parsed = new URL(activeDatabaseUrl);
    const supabaseDirectHostMatch = parsed.hostname.match(/^db\.([^.]+)\.supabase\.co$/i);
    const isSupabaseDirectHost = !!supabaseDirectHostMatch;

    console.log('parsed.host=', parsed.host, 'isSupabaseDirectHost=', isSupabaseDirectHost);

    if (isSupabaseDirectHost && !isPoolerHost && preferredPoolerHost) {
      const projectRef = supabaseDirectHostMatch?.[1];
      parsed.hostname = preferredPoolerHost;
      parsed.port = '6543';
      if (projectRef && parsed.username === 'postgres') {
        parsed.username = `postgres.${projectRef}`;
      }
    }

    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '30');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '60');
    }
    if (!useDirectUrl && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', process.env.DATABASE_CONNECTION_LIMIT?.trim() || '5');
    }
    const sslModeOverride = process.env.DATABASE_SSL_MODE?.trim();
    if (sslModeOverride) {
      parsed.searchParams.set('sslmode', sslModeOverride);
    } else if (!parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require');
    }

    const resolvedUrl = parsed.toString();
    console.log('resolvedUrl=', resolvedUrl);
    if (resolvedUrl === activeDatabaseUrl) return {};

    return {
      datasources: {
        db: {
          url: resolvedUrl,
        },
      },
    };
  } catch (err) {
    console.error('parse error', err);
    return {};
  }
};

console.log('prisma client options =', buildPrismaClientOptions());

const prisma = new PrismaClient();
console.log('Prisma initialized successfully');
await prisma.$disconnect();
