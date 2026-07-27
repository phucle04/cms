import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas or local MongoDB
 * Validates connection string and provides detailed error messages
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        'FATAL: MONGODB_URI is not set in .env. Please set it to your MongoDB Atlas connection string.'
      );
    }

    // Log sanitized connection info (mask password)
    const sanitizedUri = mongoUri.replace(/:([^:@]+)@/, ':***@');
    console.log(`[MongoDB] Connecting to: ${sanitizedUri}`);

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log('[MongoDB] Connected successfully to Atlas/MongoDB');
    console.log(`[MongoDB] Database: ${mongoose.connection.db?.databaseName || 'unknown'}`);
    return mongoose.connection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect ECONNREFUSED')) {
      console.error('[MongoDB] FATAL: Cannot connect to MongoDB');
      console.error(
        'If using MongoDB Atlas: Verify connection string and IP whitelist in Network Access'
      );
      console.error('If using local MongoDB: Ensure mongod is running on localhost:27017');
    } else if (errorMessage.includes('authentication failed') || errorMessage.includes('Invalid credentials')) {
      console.error('[MongoDB] FATAL: Authentication failed - check username/password in MONGODB_URI');
    } else if (errorMessage.includes('Invalid URI')) {
      console.error('[MongoDB] FATAL: Invalid connection string format');
    } else {
      console.error('[MongoDB] Connection error:', errorMessage);
    }

    process.exit(1);
  }
};

export default connectDB;
