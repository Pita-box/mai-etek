import { createClient } from "redis";
import { getEnvValue } from "./env";

type RedisClient = ReturnType<typeof createClient>;

const REDIS_CONNECT_TIMEOUT_MS = 500;
const REDIS_COMMAND_TIMEOUT_MS = 500;
const REDIS_FAILURE_COOLDOWN_MS = 30_000;
const REDIS_WARNING_THROTTLE_MS = 10_000;

let clientPromise: Promise<RedisClient | null> | null = null;
let disabledUntil = 0;
let lastWarningAt = 0;

function formatRedisError(error: unknown) {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  return String(error || "Unknown Redis error");
}

function warnRedis(message: string, error: unknown) {
  const now = Date.now();
  if (now - lastWarningAt < REDIS_WARNING_THROTTLE_MS) return;

  lastWarningAt = now;
  console.warn(`[Redis] ${message}:`, formatRedisError(error));
}

function disableRedisTemporarily(client?: RedisClient | null) {
  disabledUntil = Date.now() + REDIS_FAILURE_COOLDOWN_MS;
  clientPromise = null;

  try {
    client?.destroy();
  } catch {
    // Ignore cleanup failures while falling back to no-cache mode.
  }
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function createRedisClient() {
  const redisUrl = getEnvValue("REDIS_URL");
  if (!redisUrl) return null;

  const client = createClient({
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
    await withTimeout(
      client.connect(),
      REDIS_CONNECT_TIMEOUT_MS + 250,
      "Cache connection timed out",
    );
    return client;
  } catch (error) {
    warnRedis("Cache disabled", error);
    disableRedisTemporarily(client);
    return null;
  }
}

async function getRedisClient() {
  if (disabledUntil > Date.now()) return null;

  clientPromise ??= createRedisClient();
  return clientPromise;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const value = await withTimeout(
      client.get(key),
      REDIS_COMMAND_TIMEOUT_MS,
      "Cache read timed out",
    );
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    warnRedis("Cache read failed", error);
    disableRedisTemporarily(client);
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
    await withTimeout(
      client.setEx(key, ttlSeconds, JSON.stringify(value)),
      REDIS_COMMAND_TIMEOUT_MS,
      "Cache write timed out",
    );
  } catch (error) {
    warnRedis("Cache write failed", error);
    disableRedisTemporarily(client);
  }
}

export async function deleteCacheByPattern(pattern: string) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await withTimeout(
      (async () => {
        const keys: string[] = [];
        for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
          keys.push(String(key));
        }

        if (keys.length > 0) {
          await client.del(keys);
        }
      })(),
      REDIS_COMMAND_TIMEOUT_MS,
      "Cache invalidation timed out",
    );
  } catch (error) {
    warnRedis("Cache invalidation failed", error);
    disableRedisTemporarily(client);
  }
}
