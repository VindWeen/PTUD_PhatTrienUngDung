import { z } from 'zod';
import service from './organizationService.js';
import { representativeSchema as adminRepresentativeSchema } from '../admin/adminSchemas.js';
import { assign } from '../admin/adminRepository.js';

const types = ['FACULTY', 'DEPARTMENT', 'DIVISION', 'OFFICE', 'CENTER', 'UNIVERSITY'];
const createSchema = z.object({ code: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(255),
  type: z.enum(types), parentId: z.number().int().positive().nullable().optional(), description: z.string().trim().max(2000).nullable().optional() }).strict();
const updateSchema = createSchema.extend({ isActive: z.boolean(), version: z.number().int().positive() });
const transferSchema = z.object({ unitId: z.number().int().positive(), effectiveAt: z.string().datetime() }).strict();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...(data === undefined ? {} : { data }) });

export async function list(req, res, next) { try { ok(res, await service.listUnits()); } catch (e) { next(e); } }
export async function profile(req, res, next) { try { ok(res, await service.getUnitProfile(Number(req.params.id))); } catch (e) { next(e); } }
export async function create(req, res, next) { try { ok(res, await service.createUnit(createSchema.parse(req.body)), 201); } catch (e) { next(e); } }
export async function update(req, res, next) { try { ok(res, await service.updateUnit(Number(req.params.id), updateSchema.parse(req.body))); } catch (e) { next(e); } }
export async function remove(req, res, next) { try { await service.removeUnit(Number(req.params.id)); ok(res, undefined); } catch (e) { next(e); } }
export async function appoint(req, res, next) { try { ok(res, await assign(req.user.userId, 'representatives', adminRepresentativeSchema.parse({ ...req.body, unitId: Number(req.params.id) })), 201); } catch (e) { next(e); } }
export async function transfer(req, res, next) { try { ok(res, await service.transferLecturer({ lecturerId: Number(req.params.id), ...transferSchema.parse(req.body) }, req.user.userId), 201); } catch (e) { next(e); } }
export default { list, profile, create, update, remove, appoint, transfer };
