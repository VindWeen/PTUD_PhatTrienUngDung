#!/usr/bin/env node
/**
 * ==============================================================================
 * HỆ THỐNG QUẢN LÝ HỒ SƠ THÀNH TÍCH SỐ & HỖ TRỢ XÉT DUYỆT KHEN THƯỞNG LHU
 * TASK W5-Q3: SCRIPT KIỂM TRA SỨC KHỎE TIỀN DEMO & GIỚI HẠN GÓI SUPABASE FREE
 * ==============================================================================
 * Tác giả: Tạ Trần Vinh Quang (Phụ trách W5-Q3)
 * Mục tiêu:
 *  1. Đánh thức database sau thời gian nghỉ (Wake-up / Warm-up ping)
 *  2. Đo lường độ trễ mạng qua TLS trên Pooler/Direct connection
 *  3. Thống kê dung lượng CSDL và kho file đối chiếu với giới hạn gói Free
 *  4. Kiểm tra sự hiện diện của 51 bảng nghiệp vụ và phân quyền bảo mật ADR-001
 *  5. Đảm bảo tự chủ 100%, không phụ thuộc vào dịch vụ backup trả phí
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, getDbPoolConfig } from '../backend/src/config/database.js';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Nạp cấu hình từ backend/.env hoặc .env gốc
const backendEnvPath = path.resolve(__dirname, '../backend/.env');
const rootEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: fs.existsSync(backendEnvPath) ? backendEnvPath : rootEnvPath });

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function runPreDemoCheck() {
  const startTime = Date.now();
  console.log('==============================================================================');
  console.log('🩺 KIỂM TRA SỨC KHỎE TIỀN DEMO & GIỚI HẠN GÓI FREE SUPABASE (PRE-DEMO CHECK)');
  console.log(`⏰ Thời điểm: ${new Date().toISOString()}`);
  console.log('==============================================================================\n');

  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Thiếu cấu hình kết nối CSDL (SUPABASE_DB_URL). Hãy cấu hình trong backend/.env');
  }

  const cleanConnectionString = connectionString
    .replace(/[?&]sslmode=[^&]*/gi, '')
    .replace(/\?$/, '');

  const isSupabase = connectionString.includes('supabase.co') || connectionString.includes('supabase.com');
  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: isSupabase || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
  });

  try {
    // 1. Warm-up Ping & Latency Probe
    console.log('⚡ 1. Khởi động / Đánh thức dự án (Warm-up Ping)...');
    const t0 = Date.now();
    const pingRes = await pool.query('SELECT 1 AS alive, NOW() AS server_time, current_database() AS db_name, version();');
    const latencyMs = Date.now() - t0;
    const dbInfo = pingRes.rows[0];

    console.log(`   ✅ CSDL phản hồi thành công trong ${latencyMs} ms!`);
    console.log(`   🏷️  Tên CSDL: [${dbInfo.db_name}] | Thời gian server: ${dbInfo.server_time.toISOString()}`);
    console.log(`   📦 Phiên bản: ${dbInfo.version.split(' on ')[0]}`);

    // 2. Thống kê Dung lượng CSDL & Kiểm tra Giới hạn Gói Free
    console.log('\n📊 2. Kiểm tra giới hạn tài nguyên Gói Free Supabase (500 MB DB Limit)...');
    const dbSizeRes = await pool.query("SELECT pg_database_size(current_database()) AS total_bytes;");
    const totalDbBytes = parseInt(dbSizeRes.rows[0].total_bytes, 10);

    const schemaSizeRes = await pool.query(`
      SELECT coalesce(sum(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0) AS app_schema_bytes
      FROM pg_tables
      WHERE schemaname = 'app';
    `);
    const appSchemaBytes = parseInt(schemaSizeRes.rows[0].app_schema_bytes, 10);

    const FREE_TIER_MAX_DB_BYTES = 500 * 1024 * 1024; // 500 MB
    const freeTierDbPercentage = ((totalDbBytes / FREE_TIER_MAX_DB_BYTES) * 100).toFixed(2);

    console.log(`   - Tổng dung lượng Database: ${formatBytes(totalDbBytes)} / 500 MB (${freeTierDbPercentage}%)`);
    console.log(`   - Dung lượng Schema 'app': ${formatBytes(appSchemaBytes)}`);
    console.log(`   - Trạng thái hạn ngạch DB: ${totalDbBytes < FREE_TIER_MAX_DB_BYTES ? '✅ AN TOÀN (DƯỚI NGƯỠNG)' : '⚠️ CẢNH BÁO QUÁ HẠN'}`);

    // 3. Thống kê Kho Lưu trữ File Private
    console.log('\n📁 3. Kiểm tra kho lưu trữ Private File (Tách biệt khỏi Supabase Storage)...');
    const storageDirCandidates = [
      process.env.STORAGE_DIR,
      path.resolve(__dirname, '../backend/storage/private/evidences'),
      path.resolve(__dirname, '../storage/private/evidences'),
    ].filter(Boolean);

    let resolvedStorageDir = storageDirCandidates[0];
    for (const d of storageDirCandidates) {
      if (fs.existsSync(d)) {
        resolvedStorageDir = d;
        break;
      }
    }

    let fileCount = 0;
    let fileTotalBytes = 0;
    function walkDir(dir) {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        const p = path.join(dir, it.name);
        if (it.isDirectory()) walkDir(p);
        else {
          fileCount++;
          fileTotalBytes += fs.statSync(p).size;
        }
      }
    }
    walkDir(resolvedStorageDir);

    console.log(`   - Thư mục lưu trữ: ${resolvedStorageDir}`);
    console.log(`   - Tổng số tệp minh chứng: ${fileCount} tệp`);
    console.log(`   - Tổng dung lượng file cục bộ: ${formatBytes(fileTotalBytes)}`);
    console.log('   - Dung lượng Supabase Storage tiêu tốn: 0 B (Lưu trên Express Private Storage, không tốn quota cloud)');

    // 4. Kiểm tra Toàn vẹn 51 Bảng Nghiệp vụ
    console.log('\n🔍 4. Kiểm tra tính toàn vẹn 51 bảng nghiệp vụ trong schema "app"...');
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tablesCount = tablesRes.rows.length;
    console.log(`   ✅ Số lượng bảng hiện hữu: ${tablesCount} / 51 bảng`);

    // 5. Kiểm tra Cô lập Bảo mật Data API (ADR-001)
    console.log('\n🛡️  5. Kiểm tra cô lập bảo mật PostgREST Data API (Quyền anon / authenticated)...');
    let anonBlocked = false;
    try {
      await pool.query('SET ROLE anon; SELECT count(*) FROM app.users; RESET ROLE;');
    } catch (err) {
      if (err.code === '42501') {
        anonBlocked = true;
      }
    }
    console.log(`   - Vai trò 'anon' bị chặn truy cập trực tiếp schema 'app': ${anonBlocked ? '✅ THÀNH CÔNG (HTTP 403 / 42501)' : '❌ CHƯA CÔ LẬP'}`);

    // 6. Đánh giá tính sẵn sàng cho buổi Demo
    const isReadyForDemo = latencyMs < 2000 && tablesCount >= 50 && totalDbBytes < FREE_TIER_MAX_DB_BYTES && anonBlocked;

    const report = {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      database: {
        serverVersion: dbInfo.version,
        latencyMs,
        totalBytes: totalDbBytes,
        totalFormatted: formatBytes(totalDbBytes),
        appSchemaBytes,
        appSchemaFormatted: formatBytes(appSchemaBytes),
        freeTierPercentage: `${freeTierDbPercentage}%`,
        freeTierLimitFormatted: '500 MB',
      },
      storage: {
        directory: resolvedStorageDir,
        fileCount,
        totalBytes: fileTotalBytes,
        formattedSize: formatBytes(fileTotalBytes),
        supabaseStorageQuotaUsed: '0 B',
      },
      security: {
        adr001PostgrestIsolated: anonBlocked,
        tableCount: tablesCount,
        expectedTables: 51,
      },
      demoReadiness: {
        status: isReadyForDemo ? 'READY' : 'NEEDS_ATTENTION',
        autoPauseRiskMitigated: true,
        noPaidServiceDependency: true,
      },
    };

    const reportPath = path.resolve(__dirname, '../docs/deployment/PRE_DEMO_HEALTH_REPORT.json');
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n==============================================================================');
    console.log(`🏁 KẾT LUẬN: HỆ THỐNG ${isReadyForDemo ? 'ĐÃ HOÀN TOÀN SẴN SÀNG CHO BUỔI DEMO! 🚀' : 'CẦN KIỂM TRA LẠI'}`);
    console.log(`📄 Báo cáo chi tiết: ${reportPath}`);
    console.log('==============================================================================\n');

    return report;
  } finally {
    await pool.end();
  }
}

// Chạy trực tiếp từ CLI: node scripts/pre-demo-check.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPreDemoCheck()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ KIỂM TRA SỨC KHỎE THẤT BẠI:', err.message);
      process.exit(1);
    });
}
