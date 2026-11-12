import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import dotenv from '../../backend/node_modules/dotenv/lib/main.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = path.join(root, 'backend/.env.demo');
if (!fs.existsSync(envPath)) throw new Error('Demo environment not prepared: backend/.env.demo');
loadEnvFile(envPath);
// Runtime secret reference: never persist the primary pool credential in .env.demo.
if (process.env.DEMO_AI_MODE === 'live') {
  const aiSource = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env')));
  if (!aiSource.AI_POOL_URL || !aiSource.AI_POOL_TOKEN) throw new Error('Live demo needs the existing server-side AI pool configuration.');
  Object.assign(process.env, { AI_PROVIDER: 'groq', AI_POOL_MODE: 'auto', AI_POOL_URL: aiSource.AI_POOL_URL, AI_POOL_TOKEN: aiSource.AI_POOL_TOKEN });
}
const expectedStorage = path.join(root, 'backend/storage/demo');
const actualStorage = path.resolve(process.env.STORAGE_DIR || '');
if (process.env.DB_NAME !== 'PTUD_LHU_Demo' || !actualStorage.startsWith(expectedStorage + path.sep)) {
  throw new Error('Demo launcher refuses any DB/storage outside the isolated demo target.');
}
// Force isolated HTTP ports/origin even if a shell has stale environment values.
Object.assign(process.env, {
  PORT: '5001', CORS_ORIGIN: 'http://127.0.0.1:5175', APP_PUBLIC_URL: 'http://127.0.0.1:5175',
  AI_PROVIDER: process.env.AI_PROVIDER || 'mock',
  RESET_EMAIL_API_KEY: '', RESET_EMAIL_FROM: '',
  KPI_SOURCE_URL: 'http://127.0.0.1:5011/demo-kpi',
});
const { simulationRecord } = await import('../../backend/src/modules/kpi/externalContract.js');
const source = http.createServer((req, res) => {
  if (req.url !== '/demo-kpi' || req.headers.authorization !== `Bearer ${process.env.KPI_SOURCE_TOKEN}`) {
    res.writeHead(403); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ contractVersion: 'W4-P2-v1', isSimulation: true, items: [simulationRecord] }));
});
source.on('error', error => { console.error('Demo mock source failed:', error.message); process.exit(1); });
await new Promise(resolve => source.listen(5011, '127.0.0.1', resolve));
console.log('DEMO ONLY: PTUD_LHU_Demo; backend :5001; frontend http://127.0.0.1:5175; simulated KPI source :5011.');
console.log(process.env.AI_POOL_URL ? 'AI explanations: configured live pool; all seeded records remain synthetic.' : 'AI explanations: mock/offline mode.');
const child = spawn(process.execPath, ['src/server.js'], { cwd: path.join(root, 'backend'), env: process.env, stdio: 'inherit' });
child.on('exit', code => { source.close(); process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(signal); source.close(); });
