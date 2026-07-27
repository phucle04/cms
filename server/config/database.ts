import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas (cloud only - KHÔNG dùng MongoDB local).
 * Validates connection string and provides detailed error messages.
 *
 * Cấu hình chịu lỗi (2026-07-27, sau sự cố job thật chết giữa chừng vì mạng
 * chớp): đã tra cứu qua docs chính thức cho đúng version đang dùng (mongoose
 * 9.8.0 / mongodb driver 7.5.0 - xem package.json), KHÔNG đoán:
 *  - retryWrites/retryReads: driver mặc định đã là `true`, đặt tường minh ở
 *    đây để không phụ thuộc default có thể đổi ở version sau.
 *  - serverSelectionTimeoutMS tăng lên 30000 (= default chính thức của
 *    driver, https://www.mongodb.com/docs/manual/reference/connection-string-options/)
 *    thay vì 10000 cũ - cho driver đủ thời gian tự retry nội bộ khi mạng
 *    chớp trong vài giây, thay vì fail ngay. Việc mất kết nối GIỮA CHỪNG một
 *    thao tác (không phải lúc connect() lần đầu) do driver tự quản lý qua cơ
 *    chế server selection này - không cần code reconnect thủ công
 *    (reconnectTries/reconnectInterval đã bị loại bỏ khỏi driver hiện đại).
 *  - Các event 'disconnected'/'reconnected'/'error' được lắng nghe để LOG rõ
 *    ràng, giúp lần sau chẩn đoán nhanh hơn thay vì phải đọc log ngẫu nhiên.
 *  - Thao tác ghi DB trong pipeline vẫn nên bọc thêm withDbRetry()
 *    (server/utils/withDbRetry.ts) cho trường hợp mạng chớp LÂU HƠN
 *    serverSelectionTimeoutMS - đó là lớp phòng thủ Ở TẦNG ỨNG DỤNG, khác
 *    với cấu hình driver ở đây (tầng KẾT NỐI).
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

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] MẤT KẾT NỐI - driver sẽ tự thử kết nối lại (server selection nội bộ)');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] ĐÃ KHÔI PHỤC kết nối');
    });
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Lỗi kết nối (runtime):', err instanceof Error ? err.message : err);
    });

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      retryWrites: true,
      retryReads: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log('[MongoDB] Connected successfully to Atlas');
    console.log(`[MongoDB] Database: ${mongoose.connection.db?.databaseName || 'unknown'}`);
    return mongoose.connection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect ECONNREFUSED')) {
      console.error('[MongoDB] FATAL: Cannot connect to MongoDB Atlas');
      console.error('Verify connection string and IP whitelist in Atlas Network Access');
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
