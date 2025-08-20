const mongoose = require('mongoose');

// Get MongoDB connection string
const getMongoURI = () => {
  // Use environment variables - prioritize local development
  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_ATLAS_URI;

  if (!mongoURI) {
    throw new Error('MongoDB URI not found. Please set MONGODB_URI, MONGODB_ATLAS_URI, or MONGO_URI in environment variables.');
  }

  return mongoURI.trim();
};

const connectDB = async () => {
  try {
    const mongoURI = getMongoURI();
    console.log('Attempting to connect with URI:', mongoURI);
    
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
    });

    const conn = await mongoose.connect(mongoURI, {
      socketTimeoutMS: 120000, // 2 minutes
      connectTimeoutMS: 60000, // 1 minute  
      serverSelectionTimeoutMS: 60000, // 1 minute
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 20, // Increased pool size
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
    });

    return conn;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    throw err; // Re-throw to be handled by the caller
  }
};

module.exports = connectDB;
