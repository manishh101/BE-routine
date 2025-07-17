// Use the unified RabbitMQ service
const rabbitMQService = require('./rabbitmq.service');

/**
 * Establishes a connection to the RabbitMQ server
 * @param {string} connectionUrl - RabbitMQ connection URL (default: localhost)
 * @returns {Promise<boolean>} - Returns true if connection is successful
 */
async function connectQueue(connectionUrl = 'amqp://localhost') {
  try {
    console.log('Connecting to RabbitMQ...');
    
    // Use the unified service for connection
    const connected = await rabbitMQService.connect({
      connectUrl: connectionUrl,
      reconnectDelay: 5000
    });
    
    if (connected) {
      console.log('RabbitMQ connected successfully');
    }
    
    return connected;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    return false;
  }
}

/**
 * Publishes a message to the specified queue
 * @param {string} queueName - Name of the queue to publish to
 * @param {Object} messagePayload - Message payload object to be sent
 * @param {Object} options - Additional options for message publishing
 * @returns {Promise<boolean>} - Returns true if message is published successfully
 */
async function publishToQueue(queueName, messagePayload, options = {}) {
  try {
    // Use the unified service for publishing
    return await rabbitMQService.publishToQueue(
      queueName, 
      messagePayload, 
      {
        queueOptions: {
          durable: true,
          ...options.queueOptions
        },
        messageOptions: {
          persistent: true,
          ...options.messageOptions
        }
      }
    );
  } catch (error) {
    console.error(`Error publishing to queue "${queueName}":`, error);
    return false;
  }
}

/**
 * Gracefully closes the RabbitMQ connection
 * @returns {Promise<void>}
 */
async function closeConnection() {
  try {
    await rabbitMQService.close();
    console.log('RabbitMQ connection closed gracefully');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
}

/**
 * Gets the current connection status
 * @returns {boolean} - True if connected, false otherwise
 */
function isConnected() {
  return rabbitMQService.isConnected();
}

/**
 * Publishes a teacher schedule update message
 * This is a convenience function for the architecture's teacher schedule regeneration
 * @param {Array<string>} teacherIds - Array of teacher IDs to regenerate schedules for
 * @returns {Promise<boolean>}
 */
async function publishTeacherScheduleUpdate(teacherIds) {
  // Check if RabbitMQ is disabled via environment variable
  const USE_RABBITMQ = process.env.USE_RABBITMQ === 'true';
  
  // Create the message payload
  const message = {
    type: 'TEACHER_ROUTINE_UPDATE',
    teacherIds: teacherIds,
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  // If RabbitMQ is disabled, log the message and return success
  if (!USE_RABBITMQ) {
    console.log('RabbitMQ disabled. Would have published:', message);
    return true;
  }

  // Attempt to publish to queue if RabbitMQ is enabled
  return await publishToQueue('teacher_routine_updates', message);
}

/**
 * Registers a consumer for a queue
 * @param {string} queueName - Name of the queue to consume from
 * @param {Function} callback - Callback function to process messages
 * @param {Object} options - Consumer options
 * @returns {Promise<boolean>} - True if consumer was registered successfully
 */
async function consumeQueue(queueName, callback, options = {}) {
  return await rabbitMQService.consumeQueue(queueName, callback, options);
}

module.exports = {
  connectQueue,
  publishToQueue,
  consumeQueue,
  closeConnection,
  isConnected,
  publishTeacherScheduleUpdate
};
