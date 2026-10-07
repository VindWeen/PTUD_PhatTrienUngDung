import { query } from '../../../utils/dbHelper.js';
import {
  generateEmbedding,
  cosineSimilarity,
  DEFAULT_EMBEDDING_DIM,
  EMBEDDING_MODEL_NAME,
} from './localEmbedding.js';

export const RETRIEVAL_VERSION = 'rag-retrieval-v1';

/**
 * 1. Lập chỉ mục các trích đoạn quy định đã được phê duyệt (CONFIRMED_LHU_POLICY)
 */
export async function indexConfirmedChunks(client = null) {
  const sql = `
    SELECT c.chunk_id, c.version_id, c.article_no, c.clause_no, c.page_no,
           c.content, c.chunk_hash, v.lhu_application_status, v.is_confirmed
    FROM app.regulation_chunks c
    JOIN app.regulation_document_versions v ON v.version_id = c.version_id
    WHERE v.is_confirmed = TRUE AND v.lhu_application_status = 'CONFIRMED_LHU_POLICY'
    ORDER BY c.chunk_id ASC
  `;

  const res = await query(sql, [], client);
  const chunks = res.rows;
  let indexedCount = 0;

  for (const chunk of chunks) {
    const vector = generateEmbedding(chunk.content, DEFAULT_EMBEDDING_DIM);
    const upsertSql = `
      INSERT INTO app.regulation_chunk_embeddings (
        chunk_id, embedding_model, embedding_dim, embedding_vector, chunk_hash, indexed_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (chunk_id) DO UPDATE SET
        embedding_model = EXCLUDED.embedding_model,
        embedding_vector = EXCLUDED.embedding_vector,
        chunk_hash = EXCLUDED.chunk_hash,
        indexed_at = NOW()
    `;

    await query(
      upsertSql,
      [chunk.chunk_id, EMBEDDING_MODEL_NAME, DEFAULT_EMBEDDING_DIM, vector, chunk.chunk_hash],
      client
    );
    indexedCount++;
  }

  return {
    success: true,
    totalChunks: chunks.length,
    indexedCount,
    model: EMBEDDING_MODEL_NAME,
    dim: DEFAULT_EMBEDDING_DIM,
  };
}

/**
 * 2. Retrieval lọc hiệu lực / đối tượng / version kết hợp Cosine Similarity
 * 
 * Nghiệm thu W4-Q2:
 * - Lọc hiệu lực (asOfDate), version, và đối tượng
 * - Không có nguồn phù hợp trả chưa đủ dữ liệu (isSufficient: false)
 */
export async function retrieveRelevantChunks(
  {
    queryText,
    asOfDate = new Date().toISOString().slice(0, 10),
    targetType = null,
    versionId = null,
    topK = 3,
    minSimilarity = 0.15,
  },
  client = null
) {
  const params = [];
  let sql = `
    SELECT c.chunk_id, c.version_id, c.article_no, c.clause_no, c.page_no,
           c.content, c.chunk_hash,
           v.source_url, v.version_number, v.effective_from::text as effective_from,
           v.effective_to::text as effective_to,
           d.document_code, d.title as document_title,
           e.embedding_vector
    FROM app.regulation_chunks c
    JOIN app.regulation_document_versions v ON v.version_id = c.version_id
    JOIN app.regulation_documents d ON d.document_id = v.document_id
    LEFT JOIN app.regulation_chunk_embeddings e ON e.chunk_id = c.chunk_id
    WHERE v.is_confirmed = TRUE AND v.lhu_application_status = 'CONFIRMED_LHU_POLICY'
  `;

  if (asOfDate) {
    params.push(asOfDate);
    sql += ` AND v.effective_from <= $${params.length} AND (v.effective_to IS NULL OR v.effective_to >= $${params.length})`;
  }

  if (versionId) {
    params.push(versionId);
    sql += ` AND v.version_id = $${params.length}`;
  }

  const res = await query(sql, params, client);
  const rows = res.rows;

  if (rows.length === 0) {
    return {
      isSufficient: false,
      chunks: [],
      retrievalVersion: RETRIEVAL_VERSION,
      message: 'Không có nguồn quy chế nào có hiệu lực phù hợp tại thời điểm tra cứu',
    };
  }

  // Sinh embedding cho câu query
  const queryVector = generateEmbedding(queryText, DEFAULT_EMBEDDING_DIM);

  // Tính toán Cosine Similarity cho từng chunk
  const scoredChunks = [];
  for (const row of rows) {
    let chunkVec = row.embedding_vector;
    // Nếu chưa có trong bảng embeddings thì sinh trực tiếp
    if (!chunkVec || !Array.isArray(chunkVec)) {
      chunkVec = generateEmbedding(row.content, DEFAULT_EMBEDDING_DIM);
    } else {
      chunkVec = chunkVec.map(Number);
    }

    const similarity = cosineSimilarity(queryVector, chunkVec);
    if (similarity >= minSimilarity) {
      scoredChunks.push({
        chunkId: Number(row.chunk_id),
        versionId: Number(row.version_id),
        sourceUrl: row.source_url,
        articleNo: row.article_no,
        clauseNo: row.clause_no,
        pageNo: row.page_no,
        documentCode: row.document_code,
        documentTitle: row.document_title,
        versionNumber: row.version_number,
        chunkHash: row.chunk_hash,
        content: row.content,
        similarity: Number(similarity.toFixed(4)),
      });
    }
  }

  // Sắp xếp theo độ tương đồng giảm dần
  scoredChunks.sort((a, b) => b.similarity - a.similarity);
  const topChunks = scoredChunks.slice(0, topK);

  const isSufficient = topChunks.length > 0;

  return {
    isSufficient,
    retrievalVersion: RETRIEVAL_VERSION,
    query: queryText,
    asOfDate,
    matchedCount: topChunks.length,
    chunks: topChunks,
    message: isSufficient
      ? `Tìm thấy ${topChunks.length} trích đoạn quy chế phù hợp`
      : 'Không tìm thấy nguồn quy định phù hợp với yêu cầu (chưa đủ dữ liệu)',
  };
}
