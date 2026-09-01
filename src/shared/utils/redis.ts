import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const clients = new Map<string, ReturnType<typeof createClient>>();

export const getRedisClient = (component = 'shared-cache') => {
    const existingClient = clients.get(component);
    if (existingClient) return existingClient;

    const client = createClient({ url: REDIS_URL });
    client.on('error', (err) => console.error(`[REDIS:${component}] Redis Error:`, err));
    client.on('end', () => clients.delete(component));
    clients.set(component, client);
    return client;
};

export const redisClient = getRedisClient();

export const connectRedis = async (client = redisClient) => {
    if (!client.isOpen) {
        await client.connect();
        console.log('Connected to Redis successfully');
    }
    return client;
};

export const setCache = async (key: string, value: any, ttlSeconds = 3600) => {
    const client = await connectRedis();
    await client.set(key, JSON.stringify(value), {
        EX: ttlSeconds
    });
};

export const getCache = async <T>(key: string): Promise<T | null> => {
    const client = await connectRedis();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
};

export const deleteCache = async (key: string) => {
    const client = await connectRedis();
    await client.del(key);
};
