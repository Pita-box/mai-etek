"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedJson = getCachedJson;
exports.setCachedJson = setCachedJson;
exports.deleteCacheByPattern = deleteCacheByPattern;
const redis_1 = require("redis");
const env_1 = require("./env");
const REDIS_CONNECT_TIMEOUT_MS = 500;
const REDIS_COMMAND_TIMEOUT_MS = 500;
const REDIS_FAILURE_COOLDOWN_MS = 30_000;
const REDIS_WARNING_THROTTLE_MS = 10_000;
let clientPromise = null;
let disabledUntil = 0;
let lastWarningAt = 0;
function formatRedisError(error) {
    if (error instanceof Error) {
        return error.message || error.name;
    }
    return String(error || "Unknown Redis error");
}
function warnRedis(message, error) {
    const now = Date.now();
    if (now - lastWarningAt < REDIS_WARNING_THROTTLE_MS)
        return;
    lastWarningAt = now;
    console.warn(`[Redis] ${message}:`, formatRedisError(error));
}
function disableRedisTemporarily(client) {
    disabledUntil = Date.now() + REDIS_FAILURE_COOLDOWN_MS;
    clientPromise = null;
    try {
        client?.destroy();
    }
    catch {
        // Ignore cleanup failures while falling back to no-cache mode.
    }
}
async function withTimeout(operation, timeoutMs, timeoutMessage) {
    let timeout = null;
    try {
        return await Promise.race([
            operation,
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            }),
        ]);
    }
    finally {
        if (timeout)
            clearTimeout(timeout);
    }
}
async function createRedisClient() {
    const redisUrl = (0, env_1.getEnvValue)("REDIS_URL");
    if (!redisUrl)
        return null;
    const client = (0, redis_1.createClient)({
        url: redisUrl,
        disableOfflineQueue: true,
        socket: {
            connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
            reconnectStrategy: false,
        },
    });
    client.on("error", (error) => {
        warnRedis("Cache client error", error);
    });
    try {
        await withTimeout(client.connect(), REDIS_CONNECT_TIMEOUT_MS + 250, "Cache connection timed out");
        return client;
    }
    catch (error) {
        warnRedis("Cache disabled", error);
        disableRedisTemporarily(client);
        return null;
    }
}
async function getRedisClient() {
    if (disabledUntil > Date.now())
        return null;
    clientPromise ??= createRedisClient();
    return clientPromise;
}
async function getCachedJson(key) {
    const client = await getRedisClient();
    if (!client)
        return null;
    try {
        const value = await withTimeout(client.get(key), REDIS_COMMAND_TIMEOUT_MS, "Cache read timed out");
        if (!value)
            return null;
        return JSON.parse(value);
    }
    catch (error) {
        warnRedis("Cache read failed", error);
        disableRedisTemporarily(client);
        return null;
    }
}
async function setCachedJson(key, value, ttlSeconds) {
    const client = await getRedisClient();
    if (!client)
        return;
    try {
        await withTimeout(client.setEx(key, ttlSeconds, JSON.stringify(value)), REDIS_COMMAND_TIMEOUT_MS, "Cache write timed out");
    }
    catch (error) {
        warnRedis("Cache write failed", error);
        disableRedisTemporarily(client);
    }
}
async function deleteCacheByPattern(pattern) {
    const client = await getRedisClient();
    if (!client)
        return;
    try {
        await withTimeout((async () => {
            const keys = [];
            for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
                keys.push(String(key));
            }
            if (keys.length > 0) {
                await client.del(keys);
            }
        })(), REDIS_COMMAND_TIMEOUT_MS, "Cache invalidation timed out");
    }
    catch (error) {
        warnRedis("Cache invalidation failed", error);
        disableRedisTemporarily(client);
    }
}
