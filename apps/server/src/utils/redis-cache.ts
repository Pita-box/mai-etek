import { createClient } from "redis";
import { getEnvValue } from "./env";

type RedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClient | null> | null = null;

async function createRedisClient() {
  const redisUrl = getEnvValue("REDIS_URL");
  if (!redisUrl) return null;

  const client = createClient({ url: redisUrl });
  client.on("error", (error) => {
    console.warn("[Redis] Cache client error:", error.message);
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    console.warn(
      "[Redis] Cache disabled:",
      error instanceof Error ? error.message : error,
    );
    clientPromise = null;
    return null;
  }
}

async function getRedisClient() {
  clientPromise ??= createRedisClient();
  return clientPromise;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(
      "[Redis] Cache read failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.warn(
      "[Redis] Cache write failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function deleteCacheByPattern(pattern: string) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(String(key));
    }

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.warn(
      "[Redis] Cache invalidation failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
