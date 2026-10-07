import { z } from 'zod';
import { goalFields, id } from './kpiSchemas.js';
export const sourceRecord = goalFields.extend({
 externalId: z.string().trim().min(1).max(80),
 employeeId: z.string().trim().min(1).max(80),
 status: z.enum(['DRAFT','FINAL']),
 version: id,
 actual: z.number().finite().min(0).max(1e12),
 isSimulation: z.literal(true),
}).strict().refine(p => p.periodEnd >= p.periodStart);
export const sourceEnvelope = z.object({
 contractVersion: z.literal('W4-P2-v1'),
 isSimulation: z.literal(true),
 items: z.array(sourceRecord).max(500),
}).strict();
export const simulationRecord = {
 externalId: 'SIM-KPI-001', employeeId: 'SIM-EMP-001', status: 'FINAL', version: 1,
 code: 'SIM-PAPER', title: 'KPI MÔ PHỎNG - bài nghiên cứu', measureUnit: 'bài',
 periodStart: '2026-01-01', periodEnd: '2026-12-31', target: 2, actual: 1,
 plan: '', sourceNote: 'MÔ PHỎNG; chưa tích hợp hệ thống bên ngoài thật', isSimulation: true,
};
