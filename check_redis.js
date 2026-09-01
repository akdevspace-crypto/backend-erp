import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

async function checkRedis() {
    try {
        const policy = await connection.config('GET', 'maxmemory-policy');
        console.log('Redis Config:', policy);
    } catch (err) {
        console.error('Failed to get Redis config:', err.message);
    } finally {
        await connection.quit();
    }
}

checkRedis();
