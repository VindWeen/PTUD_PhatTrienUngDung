import { query, withTransaction } from '../../utils/dbHelper.js';
import storage from '../evidences/storage/localStorageAdapter.js';

export async function cleanupAchievementTrash(adapter = storage) {
  await withTransaction(async ({ client }) => {
    await client.query(`DECLARE @expired TABLE (achievement_id BIGINT PRIMARY KEY);
      INSERT INTO @expired SELECT achievement_id FROM app.achievements a WITH (UPDLOCK, HOLDLOCK)
      WHERE a.status = 'DRAFT' AND a.deleted_at <= DATEADD(day, -30, SYSUTCDATETIME())
      AND NOT EXISTS (SELECT 1 FROM app.achievement_submissions s WHERE s.achievement_id = a.achievement_id)
      AND NOT EXISTS (SELECT 1 FROM app.award_record_achievements r WHERE r.achievement_id = a.achievement_id)
      AND NOT EXISTS (SELECT 1 FROM app.kpi_results k WHERE k.achievement_id = a.achievement_id)
      AND NOT EXISTS (SELECT 1 FROM app.external_kpi_records k WHERE k.achievement_id = a.achievement_id)
      AND NOT EXISTS (SELECT 1 FROM app.achievements r WHERE r.replaces_achievement_id = a.achievement_id)
      AND NOT EXISTS (SELECT 1 FROM app.submission_evidence_files sf JOIN app.evidence_files f ON f.evidence_file_id = sf.evidence_file_id JOIN app.evidences e ON e.evidence_id = f.evidence_id WHERE e.achievement_id = a.achievement_id);
      INSERT INTO app.achievement_trash_file_cleanup(storage_key)
      SELECT DISTINCT f.storage_key FROM app.evidence_files f JOIN app.evidences e ON e.evidence_id = f.evidence_id JOIN @expired t ON t.achievement_id = e.achievement_id
      WHERE NOT EXISTS (SELECT 1 FROM app.achievement_trash_file_cleanup q WHERE q.storage_key = f.storage_key)
        AND NOT EXISTS (SELECT 1 FROM app.evidence_files other JOIN app.evidences oe ON oe.evidence_id = other.evidence_id WHERE other.storage_key = f.storage_key AND oe.achievement_id NOT IN (SELECT achievement_id FROM @expired));
      DELETE FROM app.evaluation_criterion_results WHERE run_id IN (SELECT run_id FROM app.evaluation_runs WHERE achievement_id IN (SELECT achievement_id FROM @expired));
      DELETE FROM app.ai_rag_explanations WHERE run_id IN (SELECT run_id FROM app.evaluation_runs WHERE achievement_id IN (SELECT achievement_id FROM @expired));
      DELETE FROM app.kpi_recommendations WHERE run_id IN (SELECT run_id FROM app.evaluation_runs WHERE achievement_id IN (SELECT achievement_id FROM @expired));
      DELETE FROM app.evaluation_runs WHERE achievement_id IN (SELECT achievement_id FROM @expired);
      DELETE FROM app.evidence_files WHERE evidence_id IN (SELECT evidence_id FROM app.evidences WHERE achievement_id IN (SELECT achievement_id FROM @expired));
      DELETE FROM app.evidences WHERE achievement_id IN (SELECT achievement_id FROM @expired);
      DELETE FROM app.achievement_status_histories WHERE achievement_id IN (SELECT achievement_id FROM @expired);
      DELETE FROM app.achievement_verifications WHERE achievement_id IN (SELECT achievement_id FROM @expired);
      DELETE FROM app.achievements WHERE achievement_id IN (SELECT achievement_id FROM @expired);`);
  });
  const pending = await query('SELECT TOP (100) storage_key FROM app.achievement_trash_file_cleanup');
  for (const { storage_key: key } of pending.rows) {
    if (await adapter.deleteFile(key) || !await adapter.fileExists(key)) {
      await query('DELETE FROM app.achievement_trash_file_cleanup WHERE storage_key = $1', [key]);
    }
  }
}

export function startAchievementTrashCleanup() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await cleanupAchievementTrash(); }
    catch (error) { console.error('[Achievement trash cleanup]', error.message); }
    finally { running = false; }
  };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
