/**
 * Redis Cache Configuration
 * Optional caching layer for improved performance
 */

const redis = require('redis');

let redisClient = null;
let isConnected = false;

const connectRedis = async () => {
  // Only connect if Redis URL is provided
  if (!process.env.REDIS_URL) {
    console.log('ℹ️  Redis URL not configured, caching disabled');
    return null;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis max retries reached');
            return new Error('Max retries reached');
          }
          return retries * 100; // Exponential backoff
        },
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('🔄 Connecting to Redis...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis connected and ready');
      isConnected = true;
    });

    redisClient.on('end', () => {
      console.log('🔌 Redis connection closed');
      isConnected = false;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn('⚠️  Redis not available, continuing without cache:', error.message);
    return null;
  }
};

const getCache = async (key) => {
  if (!redisClient || !isConnected) return null;
  
  try {
    const data = await redisClient.get(key);
    if (data) {
      console.log(`✅ Cache hit: ${key}`);
      return JSON.parse(data);
    }
    console.log(`❌ Cache miss: ${key}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

const setCache = async (key, value, ttl = 300) => {
  if (!redisClient || !isConnected) return false;
  
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    console.log(`✅ Cache set: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    console.error('Redis set error:', error);
    return false;
  }
};

const invalidateCache = async (pattern) => {
  if (!redisClient || !isConnected) return false;
  
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`✅ Cache invalidated: ${pattern} (${keys.length} keys)`);
    }
    return true;
  } catch (error) {
    console.error('Redis invalidate error:', error);
    return false;
  }
};

const deleteCache = async (key) => {
  if (!redisClient || !isConnected) return false;
  
  try {
    await redisClient.del(key);
    console.log(`✅ Cache deleted: ${key}`);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error);
    return false;
  }
};

const flushCache = async () => {
  if (!redisClient || !isConnected) return false;
  
  try {
    await redisClient.flushAll();
    console.log('✅ All cache cleared');
    return true;
  } catch (error) {
    console.error('Redis flush error:', error);
    return false;
  }
};

const closeRedis = async () => {
  if (redisClient && isConnected) {
    await redisClient.quit();
    console.log('🔌 Redis connection closed gracefully');
  }
};

module.exports = {
  connectRedis,
  getCache,
  setCache,
  invalidateCache,
  deleteCache,
  flushCache,
  closeRedis,
  isConnected: () => isConnected,
};
