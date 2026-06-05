import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env";

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry>();
let redisClient: RedisClientType | null = null;
let redisClientPromise: Promise<RedisClientType | null> | null = null;
let redisWarningLogged = false;

function logRedisWarning(error: unknown): void {
  if (redisWarningLogged) {
    return;
  }

  redisWarningLogged = true;
  console.warn("Redis cache unavailable", {
    error: error instanceof Error ? error.message : String(error)
  });
}

async function getRedisClient(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  if (!redisClientPromise) {
    const client = createClient({
      url: env.REDIS_URL
    }) as RedisClientType;

    client.on("error", logRedisWarning);

    redisClientPromise = client
      .connect()
      .then(() => {
        redisClient = client;
        return client;
      })
      .catch((error: unknown) => {
        logRedisWarning(error);
        redisClientPromise = null;
        return null;
      });
  }

  return redisClientPromise;
}

function getMemoryValue<T>(key: string): T | null {
  const entry = memoryCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  try {
    return JSON.parse(entry.value) as T;
  } catch (error) {
    memoryCache.delete(key);
    throw error;
  }
}

function setMemoryValue(key: string, value: string, ttlSeconds: number): void {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const cachedValue = await redis.get(key);

      if (cachedValue) {
        return JSON.parse(cachedValue) as T;
      }
    } catch (error) {
      logRedisWarning(error);
    }
  }

  return getMemoryValue<T>(key);
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const serializedValue = JSON.stringify(value);

  setMemoryValue(key, serializedValue, ttlSeconds);

  const redis = await getRedisClient();

  if (!redis) {
    return;
  }

  try {
    await redis.set(key, serializedValue, {
      EX: ttlSeconds
    });
  } catch (error) {
    logRedisWarning(error);
  }
}

export async function deleteCachedByPrefix(prefix: string): Promise<void> {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  const redis = await getRedisClient();

  if (!redis) {
    return;
  }

  try {
    const keys: string[] = [];

    for await (const key of redis.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100
    })) {
      if (typeof key === "string") {
        keys.push(key);
      }
    }

    if (keys.length > 0) {
      await Promise.all(keys.map((key) => redis.del(key)));
    }
  } catch (error) {
    logRedisWarning(error);
  }
}
