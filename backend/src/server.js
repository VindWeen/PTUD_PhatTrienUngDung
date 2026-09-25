import app from './app.js';
import config from './config/env.js';
import { connectDB, closeDB } from './config/database.js';

let server;

async function bootstrap() {
  console.log('🚀 Đang khởi động PTUD Backend REST API v1...');

  // 1. Thử kết nối tới SQL Server
  try {
    await connectDB();
  } catch (error) {
    console.warn('⚠️ Cảnh báo: Chưa kết nối được SQL Server ngay lúc này.');
    console.warn('   Server vẫn sẽ khởi động để phục vụ các yêu cầu liveness health check và báo lỗi khi truy cập database.');
  }

  // 2. Khởi chạy Express Server
  server = app.listen(config.PORT, () => {
    console.log(`================================================================`);
    console.log(`📡 Server đang lắng nghe tại: http://localhost:${config.PORT}`);
    console.log(`🩺 Health check:             http://localhost:${config.PORT}${config.API_PREFIX}/health`);
    console.log(`🔍 Readiness probe:           http://localhost:${config.PORT}${config.API_PREFIX}/health/readiness`);
    console.log(`🌍 Môi trường:              ${config.NODE_ENV}`);
    console.log(`================================================================`);
  });

  // 3. Xử lý tắt máy chủ an toàn (Graceful Shutdown)
  const shutdown = async (signal) => {
    console.log(`\n🛑 Nhận tín hiệu ${signal}. Đang đóng các kết nối an toàn...`);
    if (server) {
      server.close(() => {
        console.log('🔌 Đã dừng máy chủ HTTP Express.');
      });
    }
    await closeDB();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi khởi động nghiêm trọng:', err);
  process.exit(1);
});
