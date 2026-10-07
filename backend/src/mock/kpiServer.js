import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { simulationRecord } from '../modules/kpi/externalContract.js';
export function createMockSource({ token, items = () => [simulationRecord] } = {}) {
 if (!token) throw new Error('KPI_MOCK_TOKEN required');
 const app = express();
 app.get('/kpi', (req,res) => {
   const actual = Buffer.from(req.get('authorization') || '');
   const expected = Buffer.from(`Bearer ${token}`);
   if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) return res.sendStatus(401);
   res.set('Cache-Control','no-store').json({ contractVersion: 'W4-P2-v1', isSimulation: true, items: items() });
 });
 return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 createMockSource({token: process.env.KPI_MOCK_TOKEN}).listen(Number(process.env.KPI_MOCK_PORT || 4301),'127.0.0.1',
   () => console.log('KPI MÔ PHỎNG listening on loopback; no real external integration'));
}
