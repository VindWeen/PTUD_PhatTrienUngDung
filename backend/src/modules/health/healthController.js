import { checkHealth } from '../../config/database.js';
import config from '../../config/env.js';

/**
 * Controller kiểm tra trạng thái sức khỏe của ứng dụng và cơ sở dữ liệu
 */
export async function getLiveness(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      version: '1.0.0',
    },
  });
}

export async function getReadiness(req, res) {
  const dbHealth = await checkHealth();
  const isReady = dbHealth.status === 'UP';

  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    success: isReady,
    data: {
      status: isReady ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      system: {
        memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        uptimeSeconds: Math.floor(process.uptime()),
      },
    },
  });
}

export default { getLiveness, getReadiness };
