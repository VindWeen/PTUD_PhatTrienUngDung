import achievementService from './achievementService.js';
import {
  createAchievementSchema,
  updateAchievementSchema,
  listAchievementsQuerySchema,
  submitAchievementSchema,
  verifyAchievementSchema,
  requestCorrectionSchema,
  rejectAchievementSchema,
  cancelAchievementSchema,
  revokeAchievementSchema,
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

export async function submit(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = submitAchievementSchema.parse(req.body);
    const result = await achievementService.submitAchievement(req.user, id, payload);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function verify(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = verifyAchievementSchema.parse(req.body);
    const result = await achievementService.verifyAchievement(req.user, id, payload);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function requestCorrection(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = requestCorrectionSchema.parse(req.body);
    const result = await achievementService.requestCorrection(req.user, id, payload);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function reject(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = rejectAchievementSchema.parse(req.body);
    const result = await achievementService.rejectAchievement(req.user, id, payload);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = cancelAchievementSchema.parse(req.body);
    const result = await achievementService.cancelAchievement(req.user, id, payload);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function revoke(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = revokeAchievementSchema.parse(req.body);
    const result = await achievementService.revokeAchievement(req.user, id, payload);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getHistory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await achievementService.getAchievementHistory(req.user, id);
    ok(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getSubmissions(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await achievementService.getAchievementSubmissions(req.user, id);
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
  submit,
  verify,
  requestCorrection,
  reject,
  cancel,
  revoke,
  getHistory,
  getSubmissions,
};
