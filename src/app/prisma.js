import { PrismaClient } from "../generated/prisma/index.js";

const buildPrismaClientOptions = () => {
    const directUrl = process.env.DIRECT_URL?.trim();
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) return {};

    let parsedDatabaseUrl;
    try {
        parsedDatabaseUrl = new URL(databaseUrl);
    } catch {
        return {};
    }

    const isPoolerHost = /\.pooler\.supabase\.com$/i.test(parsedDatabaseUrl.hostname);
    const activeDatabaseUrl = databaseUrl;

    try {
        const parsed = new URL(activeDatabaseUrl);
        const supabaseDirectHostMatch = parsed.hostname.match(/^db\.([^.]+)\.supabase\.co$/i);
        const isSupabaseDirectHost = !!supabaseDirectHostMatch;
        const preferredPoolerHost = process.env.SUPABASE_POOLER_HOST?.trim();

        if (isSupabaseDirectHost && !isPoolerHost && preferredPoolerHost) {
            const projectRef = supabaseDirectHostMatch?.[1];
            parsed.hostname = preferredPoolerHost;
            parsed.port = '6543';
            if (projectRef && parsed.username === 'postgres') {
                parsed.username = `postgres.${projectRef}`;
            }
        }

        // Reduce transient connect errors on slower or unstable networks.
        if (!parsed.searchParams.has("connect_timeout")) {
            parsed.searchParams.set("connect_timeout", "30");
        }

        if (!parsed.searchParams.has("pool_timeout")) {
            parsed.searchParams.set("pool_timeout", "60");
        }

        if (!parsed.searchParams.has("pgbouncer")) {
            parsed.searchParams.set("pgbouncer", "true");
        }

        if (!parsed.searchParams.has("connection_limit")) {
            parsed.searchParams.set("connection_limit", process.env.DATABASE_CONNECTION_LIMIT?.trim() || "5");
        }

        // Optional local override, e.g. DATABASE_SSL_MODE=disable
        const sslModeOverride = process.env.DATABASE_SSL_MODE?.trim();
        if (sslModeOverride) {
            parsed.searchParams.set("sslmode", sslModeOverride);
        } else if (!parsed.searchParams.has("sslmode")) {
            parsed.searchParams.set("sslmode", "require");
        }

        const resolvedUrl = parsed.toString();
        if (resolvedUrl === activeDatabaseUrl) return {};

        return {
            datasources: {
                db: {
                    url: resolvedUrl
                }
            }
        };
    } catch {
        return {};
    }
};

const prismaClientOptions = buildPrismaClientOptions();

/** @type {PrismaClient} */
let prisma;

if (process.env.NODE_ENV === "production") {
    prisma = new PrismaClient(prismaClientOptions);
} else {
    if (!global.prisma) {
        global.prisma = new PrismaClient(prismaClientOptions);
    }
    prisma = global.prisma;
}

export { prisma };
