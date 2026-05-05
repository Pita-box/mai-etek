"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedJson = getCachedJson;
exports.setCachedJson = setCachedJson;
exports.deleteCacheByPattern = deleteCacheByPattern;
const redis_1 = require("redis");
const env_1 = require("./env");
let clientPromise = null;
async function createRedisClient() {
    const redisUrl = (0, env_1.getEnvValue)("REDIS_URL");
    if (!redisUrl)
        return null;
    const client = (0, redis_1.createClient)({ url: redisUrl });
    client.on("error", (error) => {
        console.warn("[Redis] Cache client error:", error.message);
    });
    try {
        await client.connect();
        return client;
    }
    catch (error) {
        console.warn("[Redis] Cache disabled:", error instanceof Error ? error.message : error);
        clientPromise = null;
        return null;
    }
}
async function getRedisClient() {
    clientPromise ??= createRedisClient();
    return clientPromise;
}
async function getCachedJson(key) {
    const client = await getRedisClient();
    if (!client)
        return null;
    try {
        const value = await client.get(key);
        if (!value)
            return null;
        return JSON.parse(value);
    }
    catch (error) {
        console.warn("[Redis] Cache read failed:", error instanceof Error ? error.message : error);
        return null;
    }
}
async function setCachedJson(key, value, ttlSeconds) {
    const client = await getRedisClient();
    if (!client)
        return;
    try {
        await client.setEx(key, ttlSeconds, JSON.stringify(value));
    }
    catch (error) {
        console.warn("[Redis] Cache write failed:", error instanceof Error ? error.message : error);
    }
}
async function deleteCacheByPattern(pattern) {
    const client = await getRedisClient();
    if (!client)
        return;
    try {
        const keys = [];
        for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
            keys.push(String(key));
        }
        if (keys.length > 0) {
            await client.del(keys);
        }
    }
    catch (error) {
        console.warn("[Redis] Cache invalidation failed:", error instanceof Error ? error.message : error);
    }
}
