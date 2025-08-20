/**
 * RabbitMQ Service
 * A reusable utility module for interacting with RabbitMQ
 * Provides a clean interface for connection management, publishing, and consuming
 */

const amqp = require('amqplib');

// Connection state
let connection = null;
let channel = null;
let isConnecting = false;
let reconnectTimeout = null;

// Configuration
const DEFAULT_CONNECT_OPTIONS = {
  reconnectDelay: 5000,
  maxReconnectAttempts: Infinity,
  prefetch: 1,
  connectUrl: 'amqp://localhost'
};

// Internal tracking
let currentConnectOptions = { ...DEFAULT_CONNECT_OPTIONS };
let reconnectAttempts = 0;
let connectionListeners = [];
let consumers = new Map(); // Map of queueName -> callback function

/**
 * Establishes a connection to RabbitMQ and creates a channel
 * @param {Object} options - Connection options
 * @param {string} options.connectUrl - RabbitMQ connection URL (default: amqp://localhost)
 * @param {number} options.reconnectDelay - Delay between reconnect attempts in ms (default: 5000)
 * @param {number} options.maxReconnectAttempts - Maximum number of reconnect attempts (default: Infinity)
 * @param {number} options.prefetch - Number of messages to prefetch (default: 1)
 * @returns {Promise<boolean>} - True if connection was established successfully
 */
async function connect(options = {}) {
  if (isConnecting) {
    console.log('RabbitMQ connection already in progress, skipping duplicate connect request');
    return false;
  }
  
  // Update connection options
  currentConnectOptions = { ...DEFAULT_CONNECT_OPTIONS, ...options };
  isConnecting = true;
  
  try {
    const { connectUrl } = currentConnectOptions;
    console.log(`Connecting to RabbitMQ at ${connectUrl}...`);
    
    // Create connection
    connection = await amqp.connect(connectUrl);
    
    // Create channel
    channel = await connection.createChannel();
    
    // Set prefetch count
    await channel.prefetch(currentConnectOptions.prefetch);
    
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    
    // Handle connection events
    connection.on('error', handleConnectionError);
    connection.on('close', handleConnectionClose);
    
    // Reconnect consumers if this was a reconnect
    if (consumers.size > 0) {
      console.log(`Reconnecting ${consumers.size} registered consumer(s)...`);
      await reconnectConsumers();
    }
    
    console.log('✅ RabbitMQ connected successfully');
    
    // Notify connection listeners
    notifyConnectionListeners(true);
    isConnecting = false;
    
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error.message);
    isConnecting = false;
    
    // Schedule reconnect if appropriate
    scheduleReconnect();
    
    return false;
  }
}

/**
 * Publishes a message to the specified queue
 * @param {string} queueName - Name of the queue
 * @param {Object} payload - JavaScript object to send as message payload
 * @param {Object} options - Publish options
 * @param {Object} options.queueOptions - Options for queue assertion
 * @param {Object} options.messageOptions - Options for message publishing
 * @returns {Promise<boolean>} - True if message was published successfully
 */
async function publishToQueue(queueName, payload, options = {}) {
  if (!isConnected()) {
    console.error(`Cannot publish to queue ${queueName}: Not connected to RabbitMQ`);
    return false;
  }
  
  try {
    // Default options
    const queueOptions = {
      durable: true,
      ...options.queueOptions
    };
    
    const messageOptions = {
      persistent: true,
      ...options.messageOptions
    };
    
    // Ensure queue exists
    await channel.assertQueue(queueName, queueOptions);
    
    // Convert payload to buffer
    const buffer = Buffer.from(JSON.stringify(payload));
    
    // Send message
    const published = channel.sendToQueue(queueName, buffer, messageOptions);
    
    if (published) {
      console.log(`✅ Message published to queue ${queueName}`);
      return true;
    } else {
      console.warn(`⚠️ Channel write buffer is full, cannot publish to ${queueName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error publishing to queue ${queueName}:`, error.message);
    return false;
  }
}

/**
 * Registers a consumer for the specified queue
 * @param {string} queueName - Name of the queue
 * @param {Function} callback - Callback function to process messages
 * @param {Object} options - Consumer options
 * @param {Object} options.queueOptions - Options for queue assertion
 * @param {Object} options.consumerOptions - Options for consumer
 * @returns {Promise<boolean>} - True if consumer was registered successfully
 */
async function consumeQueue(queueName, callback, options = {}) {
  if (!isConnected()) {
    console.error(`Cannot consume from queue ${queueName}: Not connected to RabbitMQ`);
    // Store callback for reconnection
    consumers.set(queueName, { callback, options });
    return false;
  }
  
  try {
    // Default options
    const queueOptions = {
      durable: true,
      ...options.queueOptions
    };
    
    const consumerOptions = {
      noAck: false,
      ...options.consumerOptions
    };
    
    // Ensure queue exists
    await channel.assertQueue(queueName, queueOptions);
    
    // Store the callback for reconnection
    consumers.set(queueName, { callback, options });
    
    // Register consumer
    await channel.consume(
      queueName,
      async (msg) => {
        if (msg) {
          try {
            await callback(msg, channel);
          } catch (error) {
            console.error(`❌ Error processing message from queue ${queueName}:`, error);
            // Negative acknowledge message on processing error (don't requeue to prevent infinite loops)
            channel.nack(msg, false, false);
          }
        }
      },
      consumerOptions
    );
    
    console.log(`✅ Consumer registered for queue ${queueName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error consuming from queue ${queueName}:`, error.message);
    return false;
  }
}

/**
 * Adds a listener for connection state changes
 * @param {Function} listener - Function to call on connection state changes
 * @returns {Function} - Function to remove the listener
 */
function addConnectionListener(listener) {
  connectionListeners.push(listener);
  
  // Return function to remove listener
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== listener);
  };
}

/**
 * Checks if connected to RabbitMQ
 * @returns {boolean} - True if connected
 */
function isConnected() {
  return connection !== null && channel !== null && connection.connection.serverProperties !== null;
}

/**
 * Closes the RabbitMQ connection and channel
 * @returns {Promise<void>}
 */
async function close() {
  // Clear reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    
    if (connection) {
      await connection.close();
      connection = null;
    }
    
    console.log('✅ RabbitMQ connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing RabbitMQ connection:', error.message);
    // Reset connection objects to ensure clean state
    channel = null;
    connection = null;
  }
  
  // Notify connection listeners
  notifyConnectionListeners(false);
}

/**
 * Gets current connection state
 * @returns {Object} - Object with connection state
 */
function getConnectionState() {
  return {
    connected: isConnected(),
    reconnectAttempts,
    consumersCount: consumers.size,
    queues: Array.from(consumers.keys())
  };
}

// PRIVATE HELPER FUNCTIONS

/**
 * Handles connection errors
 * @private
 */
function handleConnectionError(error) {
  console.error('RabbitMQ connection error:', error.message);
  // Connection errors will trigger close event, which will handle reconnect
}

/**
 * Handles connection close event
 * @private
 */
function handleConnectionClose() {
  console.log('RabbitMQ connection closed');
  
  // Clean up channel and connection
  channel = null;
  connection = null;
  
  // Notify connection listeners
  notifyConnectionListeners(false);
  
  // Schedule reconnect
  scheduleReconnect();
}

/**
 * Schedules reconnection attempt
 * @private
 */
function scheduleReconnect() {
  const { reconnectDelay, maxReconnectAttempts } = currentConnectOptions;
  
  // Check if max reconnect attempts reached
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(`❌ Maximum reconnect attempts (${maxReconnectAttempts}) reached, giving up`);
    return;
  }
  
  reconnectAttempts++;
  console.log(`⏱️ Scheduling reconnect attempt ${reconnectAttempts} in ${reconnectDelay}ms...`);
  
  // Clear any existing timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  // Schedule reconnect
  reconnectTimeout = setTimeout(() => {
    console.log(`🔄 Attempting reconnect #${reconnectAttempts}...`);
    connect(currentConnectOptions).catch(error => {
      console.error('Reconnect attempt failed:', error.message);
    });
  }, reconnectDelay);
}

/**
 * Reconnects all registered consumers
 * @private
 */
async function reconnectConsumers() {
  for (const [queueName, { callback, options }] of consumers.entries()) {
    try {
      console.log(`🔄 Reconnecting consumer for queue ${queueName}...`);
      
      // Ensure queue exists
      const queueOptions = options.queueOptions || { durable: true };
      await channel.assertQueue(queueName, queueOptions);
      
      // Register consumer
      const consumerOptions = options.consumerOptions || { noAck: false };
      await channel.consume(
        queueName,
        async (msg) => {
          if (msg) {
            try {
              await callback(msg, channel);
            } catch (error) {
              console.error(`❌ Error processing message from queue ${queueName}:`, error);
              channel.nack(msg, false, false);
            }
          }
        },
        consumerOptions
      );
      
      console.log(`✅ Consumer reconnected for queue ${queueName}`);
    } catch (error) {
      console.error(`❌ Error reconnecting consumer for queue ${queueName}:`, error.message);
    }
  }
}

/**
 * Notifies all connection listeners of state change
 * @param {boolean} connected - Whether connected
 * @private
 */
function notifyConnectionListeners(connected) {
  for (const listener of connectionListeners) {
    try {
      listener(connected);
    } catch (error) {
      console.error('Error in connection listener:', error);
    }
  }
}

module.exports = {
  connect,
  publishToQueue,
  consumeQueue,
  close,
  isConnected,
  addConnectionListener,
  getConnectionState
};
