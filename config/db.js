const mongoose = require('mongoose');

/**
 * Connect to MongoDB with optimized connection options
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    // Configure connection options for better performance
    const options = {
      // Connection pool size - adjust based on expected load
      maxPoolSize: 20,
      // Minimum pool size to maintain
      minPoolSize: 5,
      // How long to wait for a connection from the pool (ms)
      socketTimeoutMS: 45000,
      // How long to wait for a server selection (ms)
      serverSelectionTimeoutMS: 5000,
      // How long to wait for a connection to be established (ms)
      connectTimeoutMS: 10000,
      // Retry to connect if initial connection fails
      retryWrites: true,
      // Use the new URL parser
      useNewUrlParser: true,
      // Monitor for topology changes
      monitorCommands: true
    };

    await mongoose.connect(process.env.MONGO_URI, options);

    console.log('MongoDB connected successfully');

    // Add event listeners for connection issues
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully');
    });

    // Monitor connection pool
    mongoose.connection.on('open', () => {
      console.log('MongoDB connection pool opened');
    });

    // Add index creation for commonly queried fields
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating indexes for development environment...');
      // This would be where you'd add index creation for your models
      // Example: await YourModel.createIndexes();
    }

  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
