import { Redis } from "ioredis";
import { logger } from "./logger.js";

const connections = new Map();
const errorLogState = new Map();

const buildConnectionKey = (redisUrl, options = {}) =>
    JSON.stringify({
        redisUrl,
        maxRetriesPerRequest: options.maxRetriesPerRequest ?? null,
        enableReadyCheck: options.enableReadyCheck
    });

export const createRedisConnection = (component = "shared", options = {}) => {
    const redisUrl = (options.redisUrl || process.env.REDIS_URL)?.trim();

    if (!redisUrl) {
        throw new Error("REDIS_URL is required to initialize Redis connections");
    }

    const { redisUrl: _redisUrl, ...redisOptions } = options;
    const connectionKey = buildConnectionKey(redisUrl, redisOptions);
    const existingConnection = connections.get(connectionKey);
    if (existingConnection) return existingConnection;

    const connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
            if (times > 5) return null;
            return Math.min(times * 1000, 10_000);
        },
        reconnectOnError: (error) => {
            if (String(error?.message || "").includes("max number of clients")) {
                return false;
            }
            return true;
        },
        ...redisOptions
    });

    const componentLogger = logger.child({
        component,
        subsystem: "redis"
    });

    connection.on("connect", () => {
        componentLogger.info("Redis connected");
    });

    connection.on("error", (error) => {
        const message = String(error?.message || error);
        const lastLog = errorLogState.get(connectionKey) || 0;
        const shouldLog = Date.now() - lastLog > 30_000;

        if (shouldLog) {
            errorLogState.set(connectionKey, Date.now());
            componentLogger.error("Redis connection error", { error });
        } else if (message.includes("max number of clients")) {
            componentLogger.warn("Redis client limit reached; suppressing repeated Redis errors for 30 seconds");
        }
    });

    connection.on("end", () => {
        connections.delete(connectionKey);
        componentLogger.warn("Redis connection ended");
    });

    connections.set(connectionKey, connection);
    return connection;
};

export const getSharedRedisConnection = createRedisConnection;
