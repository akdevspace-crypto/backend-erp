import { prisma } from './prisma.js';

let keepAliveTimer: NodeJS.Timeout | null = null;

export const startPrismaKeepAlive = () => {
    if (keepAliveTimer) return keepAliveTimer;

    keepAliveTimer = setInterval(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch (error) {
            console.error('[DB] Keep-alive ping failed', error);
        }
    }, 30_000);

    if (typeof keepAliveTimer.unref === 'function') {
        keepAliveTimer.unref();
    }

    return keepAliveTimer;
};

export const stopPrismaKeepAlive = () => {
    if (!keepAliveTimer) return;
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
};
