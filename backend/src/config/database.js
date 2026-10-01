import pg from 'pg';
import config from './env.js';

const { Pool } = pg;

let pool = null;

/**
 * Xây dựng cấu hình kết nối pg.Pool hỗ trợ cả Supabase Direct Connection và Transaction/Session Pooler
 */
export function getDbPoolConfig() {
  const connectionString = config.DATABASE_URL || config.SUPABASE_DB_URL;
  
  // Tự động kích hoạt TLS nếu kết nối Supabase Cloud hoặc được bật qua DB_SSL
  const isSupabaseCloud = connectionString && (
    connectionString.includes('supabase.co') || 
    connectionString.includes('supabase.com') ||
    connectionString.includes('pooler.supabase.com')
  );
  const useSsl = config.DB_SSL || isSupabaseCloud;

  const baseConfig = {
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: config.NODE_ENV === 'test' ? 3000 : config.DB_CONNECTION_TIMEOUT,
  };

  if (connectionString) {
    // Loại bỏ query param sslmode để tránh pg-connection-string ghi đè tùy chọn ssl: { rejectUnauthorized: false }
    const cleanConnectionString = connectionString
      .replace(/[?&]sslmode=[^&]*/gi, '')
      .replace(/\?$/, '');

    return {
      ...baseConfig,
      connectionString: cleanConnectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    ...baseConfig,
    host: config.DB_HOST || 'localhost',
    port: config.DB_PORT || 5432,
    database: config.DB_NAME || 'postgres',
    user: config.DB_USER || 'postgres',
    password: config.DB_PASSWORD || '',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}

/**
 * Khởi tạo hoặc lấy Pool kết nối PostgreSQL (Supabase)
 */
export async function connectDB() {
  if (pool) {
    return pool;
  }

  try {
    const poolConfig = getDbPoolConfig();
    pool = new Pool(poolConfig);

    // Kiểm tra kết nối thử nghiệm
    const client = await pool.connect();
    client.release();

    const host = poolConfig.host || (poolConfig.connectionString ? poolConfig.connectionString.split('@')[1]?.split('/')[0] : 'Supabase');
    console.log(`✅ Kết nối Supabase PostgreSQL thành công qua pg Pool [TLS: ${Boolean(poolConfig.ssl)}]: ${host}`);

    pool.on('error', (err) => {
      console.error('❌ Lỗi bất thường trên pg Pool:', err.message);
    });

    return pool;
  } catch (error) {
    if (pool) {
      try { await pool.end(); } catch (_) {}
      pool = null;
    }
    throw error;
  }
}

/**
 * Lấy active pool hiện tại
 */
export function getPool() {
  if (!pool) {
    throw new Error('Cơ sở dữ liệu Supabase PostgreSQL chưa được kết nối. Hãy gọi connectDB() trước.');
  }
  return pool;
}

/**
 * Cho phép thiết lập custom pool (dùng cho testing/mock)
 */
export function setPool(customPool) {
  pool = customPool;
}

/**
 * Đóng kết nối cơ sở dữ liệu khi tắt server
 */
export async function closeDB() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('🔌 Đã đóng kết nối Supabase PostgreSQL Connection Pool.');
    } catch (error) {
      console.error('Lỗi khi đóng kết nối PostgreSQL:', error.message);
    }
  }
}

/**
 * Kiểm tra trạng thái sức khỏe kết nối Supabase PostgreSQL (Health Check Probe)
 */
export async function checkHealth() {
  const startTime = Date.now();
  try {
    if (!pool) {
      await connectDB();
    }
    const result = await pool.query('SELECT 1 AS is_alive, NOW() AS server_time;');
    const latencyMs = Date.now() - startTime;

    return {
      status: 'UP',
      isConnected: true,
      latencyMs,
      serverTime: result.rows[0]?.server_time || new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'DOWN',
      isConnected: false,
      latencyMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

export { pg, Pool };
export default { connectDB, getPool, setPool, closeDB, checkHealth, getDbPoolConfig, pg, Pool };
