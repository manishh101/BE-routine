const mongoose = require('mongoose');

// Middleware to optimize database queries
class QueryOptimizer {
  
  // Add lean() to queries that don't need full mongoose documents
  static leanQueries(schema) {
    schema.pre(['find', 'findOne', 'findOneAndUpdate'], function() {
      if (!this.getOptions().lean && this.op !== 'findOneAndUpdate') {
        this.lean();
      }
    });
  }

  // Add pagination helper
  static addPagination(schema) {
    schema.statics.paginate = async function(filter = {}, options = {}) {
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      const [docs, total] = await Promise.all([
        this.find(filter)
          .select(options.select)
          .sort(options.sort || { createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.countDocuments(filter)
      ]);
      
      return {
        docs,
        total,
        page,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      };
    };
  }

  // Batch operations helper
  static addBatchOperations(schema) {
    schema.statics.batchInsert = async function(docs, options = {}) {
      const batchSize = options.batchSize || 100;
      const results = [];
      
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const batchResult = await this.insertMany(batch, {
          ordered: false, // Continue on error
          ...options
        });
        results.push(...batchResult);
      }
      
      return results;
    };

    schema.statics.batchUpdate = async function(updates) {
      const bulkOps = updates.map(update => ({
        updateOne: {
          filter: update.filter,
          update: update.update,
          upsert: update.upsert || false
        }
      }));
      
      return this.bulkWrite(bulkOps);
    };
  }

  // Connection monitoring
  static setupConnectionMonitoring() {
    mongoose.connection.on('connected', () => {
      console.log('📊 DB Query Optimizer: Connection established');
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📊 DB Query Optimizer: Connection lost');
    });

    // Monitor slow queries
    mongoose.set('debug', (collectionName, method, query, doc) => {
      const start = Date.now();
      
      // Log queries that take more than 100ms
      setTimeout(() => {
        const duration = Date.now() - start;
        if (duration > 100) {
          console.warn(`🐌 Slow Query: ${collectionName}.${method}`, {
            query,
            duration: `${duration}ms`
          });
        }
      }, 0);
    });
  }

  // Apply all optimizations to a schema
  static applyAll(schema) {
    this.leanQueries(schema);
    this.addPagination(schema);
    this.addBatchOperations(schema);
  }
}

module.exports = QueryOptimizer;
