const NodeCache = require('node-cache');

// Create cache instances with different TTL for different data types
const routineCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes for routine data
  checkperiod: 60, // Check for expired keys every minute
  maxKeys: 1000 // Limit cache size
});

const staticCache = new NodeCache({ 
  stdTTL: 3600, // 1 hour for static data (departments, subjects, etc.)
  checkperiod: 300,
  maxKeys: 500
});

const userCache = new NodeCache({ 
  stdTTL: 900, // 15 minutes for user data
  checkperiod: 120,
  maxKeys: 200
});

class CacheManager {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Log cache statistics periodically
    setInterval(() => {
      console.log('Cache Stats:', {
        routine: routineCache.getStats(),
        static: staticCache.getStats(),
        user: userCache.getStats()
      });
    }, 300000); // Every 5 minutes
  }

  // Generic cache middleware factory
  createCacheMiddleware(cacheType = 'routine', customTTL = null) {
    return (req, res, next) => {
      const cache = this.getCache(cacheType);
      const key = this.generateKey(req);
      
      const cachedData = cache.get(key);
      if (cachedData) {
        console.log(`Cache HIT: ${key}`);
        return res.json(cachedData);
      }
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          console.log(`Cache SET: ${key}`);
          cache.set(key, data, customTTL);
        }
        originalJson.call(this, data);
      };
      
      next();
    };
  }

  getCache(type) {
    switch (type) {
      case 'static': return staticCache;
      case 'user': return userCache;
      default: return routineCache;
    }
  }

  generateKey(req) {
    const userId = req.user ? req.user._id : 'anonymous';
    const query = JSON.stringify(req.query);
    const params = JSON.stringify(req.params);
    return `${req.method}:${req.path}:${userId}:${query}:${params}`;
  }

  // Manual cache operations
  set(key, value, type = 'routine', ttl = null) {
    const cache = this.getCache(type);
    return cache.set(key, value, ttl);
  }

  get(key, type = 'routine') {
    const cache = this.getCache(type);
    return cache.get(key);
  }

  del(key, type = 'routine') {
    const cache = this.getCache(type);
    return cache.del(key);
  }

  // Clear cache by pattern
  clearByPattern(pattern, type = 'routine') {
    const cache = this.getCache(type);
    const keys = cache.keys().filter(key => key.includes(pattern));
    return cache.del(keys);
  }

  // Clear all caches
  flushAll() {
    routineCache.flushAll();
    staticCache.flushAll();
    userCache.flushAll();
    console.log('All caches cleared');
  }

  // Get cache statistics
  getStats() {
    return {
      routine: routineCache.getStats(),
      static: staticCache.getStats(),
      user: userCache.getStats()
    };
  }
}

module.exports = new CacheManager();
