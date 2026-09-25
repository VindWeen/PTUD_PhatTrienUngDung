import sql from 'mssql';
import config from './env.js';

let pool = null;

const dbConfig = {
  server: config.DB_SERVER,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  options: {
    encrypt: config.DB_ENCRYPT,
    trustServerCertificate: config.DB_TRUST_SERVER_CERTIFICATE,
    enableArithAbort: true,
  },
  connectionTimeout: config.NODE_ENV === 'test' ? 1000 : config.DB_CONNECTION_TIMEOUT,
  requestTimeout: config.NODE_ENV === 'test' ? 1000 : config.DB_REQUEST_TIMEOUT,
  pool: {
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
  },
};

/**
 * Khởi tạo hoặc lấy Connection Pool tới Microsoft SQL Server
 */
export async function connectDB() {
  if (pool && pool.connected) {
    return pool;
  }

  try {
    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
    console.log(`✅ Kết nối SQL Server thành công: ${config.DB_SERVER}:${config.DB_PORT}/${config.DB_NAME}`);
    
    pool.on('error', (err) => {
      console.error('❌ Lỗi bất thường trên SQL Server Connection Pool:', err);
    });

    return pool;
  } catch (error) {
    if (pool) {
      try { await pool.close(); } catch (_) {}
      pool = null;
    }
    throw error;
  }
}

/**
 * Lấy active pool hiện tại
 */
export function getPool() {
  if (!pool || !pool.connected) {
    throw new Error('Cơ sở dữ liệu chưa được kết nối. Hãy gọi connectDB() trước.');
  }
  return pool;
}

/**
 * Đóng kết nối cơ sở dữ liệu khi tắt server
 */
export async function closeDB() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      console.log('🔌 Đã đóng kết nối SQL Server Connection Pool.');
    } catch (error) {
      console.error('Lỗi khi đóng kết nối SQL Server:', error);
    }
  }
}

/**
 * Kiểm tra trạng thái sức khỏe kết nối SQL Server (Health Check)
 */
export async function checkHealth() {
  const startTime = Date.now();
  try {
    if (!pool || !pool.connected) {
      // Thử kết nối nếu chưa kết nối
      await connectDB();
    }
    const request = pool.request();
    const result = await request.query('SELECT 1 AS isAlive, SYSUTCDATETIME() AS serverTime;');
    const latencyMs = Date.now() - startTime;

    return {
      status: 'UP',
      isConnected: true,
      latencyMs,
      serverTime: result.recordset[0].serverTime,
    };
  } catch (error) {
    if (pool) {
      try { await pool.close(); } catch (_) {}
      pool = null;
    }
    return {
      status: 'DOWN',
      isConnected: false,
      latencyMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

export { sql };
export default { connectDB, getPool, closeDB, checkHealth, sql };
