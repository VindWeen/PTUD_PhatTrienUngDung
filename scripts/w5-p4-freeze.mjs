// Hash only reviewed, repository-local report inputs. Never include env/backups/storage.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dirs = ['docs/report-inputs', 'docs/testing/week-4/media', 'docs/weekly/images', 'Page_Design', 'database/migrations'];
const files = [
  'backend/src/modules/evidences/evidenceService.js', 'backend/tests/w5-p4.test.js',
  'backend/tests/w5-p3.integration.js', 'scripts/backup.mjs', 'scripts/restore.mjs',
  'scripts/w5-p4-freeze.mjs', 'docs/PROJECT_DEVELOPMENT_BLUEPRINT.md',
  'docs/database/ERD.md', 'docs/database/DATA_DICTIONARY.md', 'docs/database/SCHEMA_DDL.sql',
  'docs/api/WORKFLOW_W3_Q1.md', 'docs/api/openapi.json',
  'backend/src/modules/achievements/achievementService.js',
  'backend/src/modules/awards/applicationService.js',
  'docs/DEMO_SCRIPT.md', 'docs/USER_GUIDE.md',
  'docs/testing/week-4/ui-result.json', 'docs/testing/w5-p1/load-result.json',
  'docs/testing/w5-p1/overlapping-load-result.json',
  'docs/ai/recommender-eval/README.md', 'docs/ai/recommender-eval/results.json',
  'docs/weekly/WEEK_05_W5_Q1.md', 'docs/weekly/WEEK_05_W5_Q3.md', 'docs/weekly/WEEK_05_W5_P3.md',
  'docs/weekly/WEEK_05_W5_P4.md',
];
for (const dir of dirs) {
  for (const item of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    if (item.isFile() && item.name !== 'candidate-manifest.json') files.push(`${dir}/${item.name}`);
  }
}
const entries = [];
for (const file of [...new Set(files)].sort()) {
  const bytes = await fs.readFile(path.join(root, file));
  entries.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const manifest = {
  task: 'W5-P4', status: 'CANDIDATE_RESTORE_BLOCKED',
  baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  codeVersion: 'baselineCommit plus uncommitted W5-P4 diff; source and test hashes below',
  generatedAt: new Date().toISOString(), timezone: 'Asia/Saigon',
  limitations: ['No verified remote PR', 'Historical ERD, fixtures and mockups retain their labels', 'Manifest excludes itself; not a release acceptance certificate'],
  entries,
};
await fs.writeFile(path.join(root, 'docs/report-inputs/candidate-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Frozen ${entries.length} reviewed inputs at ${manifest.baselineCommit}`);
