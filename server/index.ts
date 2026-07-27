import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes/api';
import { validateAIConfig } from './services/aiService';
import { checkYtDlpAvailable } from './services/videoDownloadService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRoutes);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Validate AI configuration first (fail-fast if misconfigured)
    console.log('[Server] Validating AI configuration...');
    validateAIConfig();

    // Health-check yt-dlp (tầng dự phòng tải video) - KHÔNG fail-fast, chỉ
    // WARN rõ ràng nếu thiếu, vì tầng (a) Apify KV store vẫn hoạt động độc
    // lập mà không cần yt-dlp.
    await checkYtDlpAvailable();

    // Connect to database
    await connectDB();

    app.listen(PORT, () => {
      console.log(`[Server] Started on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] Ready to accept requests`);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Server] FATAL: Failed to start server:', errorMessage);
    process.exit(1);
  }
};

startServer();

export default app;
