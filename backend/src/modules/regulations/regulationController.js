import * as regulationService from './regulationService.js';
import {
  createDocumentSchema,
  createVersionSchema,
  batchCreateChunksSchema,
  createCriteriaVersionSchema,
  confirmVersionSchema,
  confirmCriteriaSchema,
  queryRegulationsSchema,
  queryCriteriaSchema,
} from './regulationSchemas.js';

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...(data === undefined ? {} : { data }) });

// Documents
export async function listDocuments(req, res, next) {
  try {
    const query = queryRegulationsSchema.parse(req.query);
    const result = await regulationService.getDocuments(query, req.user);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getDocumentById(req, res, next) {
  try {
    const documentId = Number(req.params.id);
    const result = await regulationService.getDocumentById(documentId);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createDocument(req, res, next) {
  try {
    const payload = createDocumentSchema.parse(req.body);
    const result = await regulationService.createDocument(payload, req.user);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

// Versions
export async function getVersionById(req, res, next) {
  try {
    const versionId = Number(req.params.id);
    const result = await regulationService.getVersionById(versionId);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createVersion(req, res, next) {
  try {
    const documentId = Number(req.params.documentId);
    const payload = createVersionSchema.parse(req.body);
    const result = await regulationService.createVersion(documentId, payload, req.user);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function confirmVersion(req, res, next) {
  try {
    const versionId = Number(req.params.id);
    const payload = confirmVersionSchema.parse(req.body);
    const result = await regulationService.confirmVersion(versionId, payload, req.user);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

// Chunks
export async function getChunks(req, res, next) {
  try {
    const versionId = Number(req.params.versionId);
    const result = await regulationService.getChunksByVersion(versionId);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function addChunks(req, res, next) {
  try {
    const versionId = Number(req.params.versionId);
    const payload = batchCreateChunksSchema.parse(req.body);
    const result = await regulationService.addChunks(versionId, payload.chunks, req.user);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

// Criteria
export async function listCriteria(req, res, next) {
  try {
    const query = queryCriteriaSchema.parse(req.query);
    const result = await regulationService.getCriteria(query, req.user);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createCriteria(req, res, next) {
  try {
    const versionId = Number(req.params.versionId);
    const payload = createCriteriaVersionSchema.parse(req.body);
    const result = await regulationService.createCriteriaVersion(versionId, payload, req.user);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function confirmCriteria(req, res, next) {
  try {
    const criteriaVersionId = Number(req.params.id);
    const payload = confirmCriteriaSchema.parse(req.body);
    const result = await regulationService.confirmCriterion(criteriaVersionId, payload, req.user);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
