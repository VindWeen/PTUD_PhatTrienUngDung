import achievementService from './achievementService.js';
import {
  createAchievementSchema,
  updateAchievementSchema,
  listAchievementsQuerySchema,
} from './achievementSchemas.js';

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...(data === undefined ? {} : { data }) });

export async function list(req, res, next) {
  try {
    const query = listAchievementsQuerySchema.parse(req.query);
    const result = await achievementService.listAchievements(req.user, query);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await achievementService.getAchievementById(req.user, id);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const payload = createAchievementSchema.parse(req.body);
    const result = await achievementService.createAchievement(req.user, payload);
    ok(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = updateAchievementSchema.parse(req.body);
    const result = await achievementService.updateAchievement(req.user, id, payload);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await achievementService.deleteAchievement(req.user, id);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  getById,
  create,
  update,
  remove,
};
