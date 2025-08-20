const app = require('./app');
const { connectQueue, closeConnection } = require('./services/queue.service');

const PORT = process.env.PORT || 7102;

// Global error handlers for unhandled promises and exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', err.name, err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

const server = app.listen(PORT, async () => {
  console.log('🚀 Server Configuration:');
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:7103'}`);
  console.log(`   API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log('✅ BE Routine Management System API is running...');
  
  // Only initialize RabbitMQ if enabled
  const USE_RABBITMQ = process.env.USE_RABBITMQ === 'true';
  
  if (USE_RABBITMQ) {
    try {
      // Initialize RabbitMQ connection
      const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
      console.log(`🐰 Connecting to RabbitMQ: ${rabbitMQUrl}`);
      
      const queueConnected = await connectQueue(rabbitMQUrl);
      
      if (queueConnected) {
        console.log('✅ RabbitMQ connection established');
      } else {
        console.warn('⚠️  RabbitMQ connection failed - using fallback mode');
      }
    } catch (error) {
      console.error('❌ RabbitMQ connection error:', error.message);
      console.warn('⚠️  Continuing without RabbitMQ - using fallback mode');
    }
  } else {
    console.log('ℹ️  RabbitMQ integration disabled - using direct processing mode');
  }
});

// Enhanced graceful shutdown function
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received, initiating graceful shutdown...`);
  
  try {
    // Stop accepting new requests
    server.close(async () => {
      console.log('📡 HTTP server closed');
      
      try {
        // Close RabbitMQ connection
        if (process.env.USE_RABBITMQ === 'true') {
          await closeConnection();
          console.log('🐰 RabbitMQ connection closed');
        }
        
        // Close database connections (if you have a db close function)
        // await mongoose.connection.close();
        // console.log('🍃 Database connection closed');
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('⏰ Forcing shutdown after 10 seconds...');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err, promise) => {
  console.error('💥 UNHANDLED PROMISE REJECTION! Shutting down...');
  console.error('Error:', err.name, err.message);
  console.error('Stack:', err.stack);
  console.error('Promise:', promise);
  
  // Close server & exit process
  server.close(async () => {
    try {
      if (process.env.USE_RABBITMQ === 'true') {
        await closeConnection();
      }
    } catch (closeError) {
      console.error('Error closing connections:', closeError);
    }
    process.exit(1);
  });
});

// Export server for testing purposes
module.exports = server;