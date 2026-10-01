import { z } from 'zod';
import profileService from './profileService.js';

const updateSchema = z.object({
  phone: z.string().trim().max(20).nullable().optional(),
  title: z.string().trim().max(50).nullable().optional(),
  degree: z.string().trim().max(50).nullable().optional(),
  version: z.number().int().positive(),
}).strict();

const send = (res, data) => res.status(200).json({ success: true, data });

export async function getMe(req, res, next) {
  try { send(res, await profileService.getOwnProfile(req.user.userId)); } catch (error) { next(error); }
}
export async function updateMe(req, res, next) {
  try {
    const own = await profileService.getOwnProfile(req.user.userId);
    send(res, await profileService.updateProfile(req.user.userId, own.lecturerId, updateSchema.parse(req.body)));
  } catch (error) { next(error); }
}
export async function getById(req, res, next) {
  try { send(res, await profileService.getProfile(Number(req.params.id))); } catch (error) { next(error); }
}
export async function updateById(req, res, next) {
  try { send(res, await profileService.updateProfile(req.user.userId, Number(req.params.id), updateSchema.parse(req.body))); } catch (error) { next(error); }
}

export default { getMe, updateMe, getById, updateById };
