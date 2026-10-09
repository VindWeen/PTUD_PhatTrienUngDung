// Read-only Git export and SHA-256 inventory. Never commits, rewrites history or uploads.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const root = process.cwd();
const docs = path.join(root, 'docs/testing/w6-p3');
const digest = b => createHash('sha256').update(b).digest('hex');
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const csvCell = s => '"' + String(s ?? '').replaceAll('"', '""') + '"';
const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
const tasks = text => [...new Set([...text.matchAll(/(?<![A-Za-z0-9])W(\d+)[-_ ]?([PQ])[-_ ]?(\d+)(?![A-Za-z0-9])/gi)].map(m => `W${m[1]}-${m[2].toUpperCase()}${m[3]}`))];
const md = s => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');
const timestamp = new Date().toISOString();
await fs.mkdir(docs, { recursive: true });

if (process.argv.includes('--verify')) {
  const manifest = JSON.parse(await fs.readFile(path.join(docs, 'evidence-manifest.json'), 'utf8'));
  if (manifest.recordingStatus !== 'PASS') throw new Error('Recording is incomplete; hashes alone do not make the demo PASS');
  if (manifest.videoValidationStatus !== 'PASS') throw new Error('Decode/seek validation must PASS before handing off video');
  for (const a of manifest.artifacts) {
    const b = await fs.readFile(path.resolve(root, a.path));
    if (b.length !== a.bytes || digest(b) !== a.sha256) throw new Error('Evidence changed: ' + a.path);
    if (a.originCommit) git(['cat-file', '-e', a.originCommit + '^{commit}']);
  }
  for (const source of manifest.recordingSourceHashes) {
    if (digest(await fs.readFile(path.resolve(root, source.path))) !== source.sha256) throw new Error('Recording source differs from current file: ' + source.path);
  }
  git(['cat-file', '-e', manifest.baselineCommit + '^{commit}']);
  for (const c of JSON.parse(await fs.readFile(path.join(docs, 'commits.json'), 'utf8')).commits) git(['cat-file', '-e', c.sha + '^{commit}']);
  console.log(`W6-P3 evidence verification PASS: ${manifest.artifacts.length} artifact hashes/bytes; full commit SHAs resolve`);
} else {
  const baselineCommit = git(['rev-parse', 'HEAD']);
  const records = git(['log', 'HEAD', '--format=%H%x1f%an%x1f%aI%x1f%cn%x1f%cI%x1f%P%x1f%s']).split('\n');
  const commits = records.map(line => {
    const [sha, author, authorDate, committer, commitDate, parents, subject] = line.split('\x1f');
    const touched = git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', sha]).split('\n').filter(Boolean);
    const declared = tasks(subject);
    const fileAssociation = declared.length ? [] : tasks(touched.join(' '));
    const merge = parents.split(' ').filter(Boolean).length > 1;
    return { sha, author, authorDate, committer, commitDate, parents: parents.split(' ').filter(Boolean), subject, tasks: declared.length ? declared : fileAssociation, taskBasis: declared.length ? 'DECLARED_IN_SUBJECT' : fileAssociation.length ? 'FILE_NAME_ASSOCIATION_NOT_DECLARED' : 'UNMAPPED', merge, filesChanged: merge ? null : touched.length };
  });
  await fs.writeFile(path.join(docs, 'commits.json'), JSON.stringify({ task: 'W6-P3', baselineCommit, exportedAt: timestamp, scope: 'commits reachable from HEAD; Git author/committer/dates preserved; no alias reassignment', commits }, null, 2));
  await fs.writeFile(path.join(docs, 'commits.csv'), csv([['task', 'taskBasis', 'author', 'sha', 'authorDate', 'committer', 'commitDate', 'merge', 'filesChanged', 'subject'], ...commits.map(c => [c.tasks.join(';') || 'UNMAPPED', c.taskBasis, c.author, c.sha, c.authorDate, c.committer, c.commitDate, c.merge, c.filesChanged, c.subject])]));
  const remote = spawnSync('git', ['ls-remote', 'origin', 'refs/pull/*/head'], { encoding: 'utf8' });
  const failure = /SEC_E_NO_CREDENTIALS/.test(remote.stderr || '') ? 'SEC_E_NO_CREDENTIALS' : remote.status !== 0 ? 'REMOTE_UNAVAILABLE' : null;
  const prs = commits.filter(c => /Merge pull request #\d+/.test(c.subject)).map(c => ({ number: Number(c.subject.match(/Merge pull request #(\d+)/)[1]), url: `https://github.com/VindWeen/PTUD_PhatTrienUngDung/pull/${c.subject.match(/Merge pull request #(\d+)/)[1]}`, mergeCommit: c.sha, parentShas: c.parents, author: c.author, tasks: c.tasks, source: 'LOCAL_GIT_MERGE_SUBJECT', liveReviewAndMergeStatus: 'UNVERIFIED' }));
  await fs.writeFile(path.join(docs, 'prs.json'), JSON.stringify({ baselineCommit, checkedAt: timestamp, remoteProbe: { command: "git ls-remote origin 'refs/pull/*/head'", exitCode: remote.status, failure }, note: 'Local merge subjects prove local history references, not current GitHub approval/merge state. No PR URLs invented for task commits.', prs }, null, 2));
  const authors = [...new Set(commits.map(c => c.author))];
  let table = `# W6-P3 — Bảng đóng góp từ Git\n\nXuất ${timestamp}, baseline \`${baselineCommit}\`. Lịch sử reachable từ HEAD; tác giả/ngày Git giữ nguyên. Nhãn task từ subject; nhãn suy ra tên file được ghi riêng, không coi là phân công đã xác nhận. Các commit merge tách khỏi commit thay đổi; số commit không đo chất lượng hay chia đều công việc.\n\n| Tác giả nguyên bản | Commit không merge | Merge |\n|---|---:|---:|\n`;
  for (const author of authors) table += `| ${md(author)} | ${commits.filter(c => c.author === author && !c.merge).length} | ${commits.filter(c => c.author === author && c.merge).length} |\n`;
  table += '\nKhông đồng nhất VindWeen hoặc tên khác với Quang/Phước nếu chưa có xác nhận. W6-P3 hiện là diff chưa commit, không có SHA mới và không tính thêm commit cho người nào.\n\n| Task | Tác giả Git | SHA đầy đủ / thay đổi | Cơ sở gắn task |\n|---|---|---|---|\n';
  for (const c of commits) table += `| ${c.tasks.join(', ') || 'UNMAPPED'} | ${md(c.author)} | [${c.sha}](https://github.com/VindWeen/PTUD_PhatTrienUngDung/commit/${c.sha}) — ${md(c.subject)} | ${c.taskBasis} |\n`;
  table += '\n[CSV đầy đủ](commits.csv) · [JSON tác giả/committer/parents/ngày](commits.json) · [PR local và trạng thái xác minh](prs.json) · [Review/release gate](REVIEW_RELEASE.md). Link commit là tham chiếu theo SHA local, chưa chứng minh SHA đã push lên remote.\n';
  await fs.writeFile(path.join(docs, 'CONTRIBUTIONS.md'), table);
  const artifacts = [];
  async function add(p, task, kind, originCommit = null, state = 'CURRENT_FILE') {
    try {
      const b = await fs.readFile(path.resolve(root, p));
      artifacts.push({ path: p.replaceAll('\\', '/'), task, kind, originCommit, inventoryBaselineCommit: baselineCommit, state, bytes: b.length, sha256: digest(b) });
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  async function walk(dir) {
    const files = [];
    try { for (const item of await fs.readdir(dir, { withFileTypes: true })) { const p = path.join(dir, item.name); files.push(...(item.isDirectory() ? await walk(p) : [p])); } } catch (e) { if (e.code !== 'ENOENT') throw e; }
    return files;
  }
  for (const file of await walk(path.join(root, 'output/w6-p3'))) {
    if (/\.(webm|png|json|log|csv|pdf)$/.test(file)) await add(path.relative(root, file), 'W6-P3', /\.webm$/.test(file) ? 'REAL_BROWSER_VIDEO' : /\.png$/.test(file) ? 'REAL_BROWSER_SCREENSHOT' : 'LOCAL_RUN_ARTIFACT', null, 'UNCOMMITTED_W6_P3_RUN');
  }
  for (const file of ['docs/weekly/WEEK_06_W6_P2.md', 'docs/weekly/WEEK_06_W6_Q2.md', 'docs/weekly/WEEK_05_W5_Q4.md', 'docs/testing/w6-p2/REHEARSAL_CHECKLIST.md', 'docs/USER_GUIDE.md', 'docs/report-inputs/RELEASE_CHECKLIST_W6Q2.json']) await add(file, tasks(file)[0] || 'W6-P2', 'COMMITTED_DEPENDENCY_DOCUMENT', git(['log', '-1', '--format=%H', '--', file]));
  for (const file of ['output/w6-p2/rehearsal-restore.log', 'output/w6-p2/ui-loaded-final.log', 'output/w6-p2/ui/result.json']) await add(file, 'W6-P2', 'HISTORICAL_LOCAL_EVIDENCE', null, 'HISTORICAL_UNCOMMITTED_MEDIA; RUN_BASELINE_16ee566; DOCUMENTATION_COMMIT_2774075');
  for (const file of ['scripts/w6-p3-video.mjs', 'scripts/w6-p3-recorder.mjs', 'scripts/w6-p3-evidence.mjs', 'backend/tests/w5-p3.integration.js']) await add(file, 'W6-P3', 'CAPTURE_OR_EXPORT_SOURCE', null, 'UNCOMMITTED_W6_P3_SOURCE');
  const result = await fs.readFile(path.join(root, 'output/w6-p3/recording-result.json'), 'utf8').then(JSON.parse).catch(() => null);
  const validation = await fs.readFile(path.join(root, 'output/w6-p3/video-validation.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (result) {
    const lineage = {
      admin: [['W2-P1', '4ea8344']],
      'individual-api': [['W2-Q1', 'c17c6cb'], ['W2-Q2', 'd8448d8']],
      'individual-submitted': [['W2-Q3', 'f091c57']],
      'collective-api': [['W2-Q1', 'c17c6cb'], ['W2-Q2', 'd8448d8']],
      'collective-submitted': [['W2-Q3', 'f091c57']],
      'wrong-role': [['W1-Q3', '5893dba']], verified: [['W2-Q3', 'f091c57']],
      reports: [['W3-P1', 'd834b6a']], cycle: [['W3-P3', '4723c66']],
      'proposal-submitted': [['W3-P3', '4723c66']], forward: [['W3-P3', '4723c66']],
      occ: [['W4-P3', '7851e61']], recommended: [['W4-P3', '7851e61']],
      'missing-file': [['W2-P2', '53167d8']], recorded: [['W2-P2', '53167d8']],
      'release-gates': [['W6-P2', '2774075'], ['W6-Q2', 'afd2377']],
    };
    const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    let timeline = `# W6-P3 — Timeline video thực tế\n\nRecording status **${result.status}**; SHA chạy \`${result.baselineCommit}\` + harness chưa commit (hash trong recording-result). SHA triển khai từng task bên dưới chỉ là lineage của chức năng, không phải SHA mà video đã quay ở thời điểm cũ.\n\n| Mốc từ đầu video | Bước thực tế | Task / SHA triển khai | Ảnh |\n|---|---|---|---|\n`;
    for (const s of result.steps) {
      const origins = (lineage[s.id] || []).map(([task, short]) => { const sha = git(['rev-parse', short]); return `${task}: [${sha}](https://github.com/VindWeen/PTUD_PhatTrienUngDung/commit/${sha})`; }).join('; ') || 'W6-P3 capture chưa commit';
      const imagePath = `output/w6-p3/images/${s.id}.png`;
      const exists = await fs.access(path.join(root, imagePath)).then(() => true).catch(() => false);
      timeline += `| ${time(s.atSeconds)} (${s.atSeconds.toFixed(3)}s) | ${md(s.text)} | ${origins} | ${exists ? `[${s.id}](../../../${imagePath})` : 'Caption, không có ảnh riêng'} |\n`;
    }
    timeline += '\n[Video WebM local](../../../output/w6-p3/demo.webm) · [Recording result](../../../output/w6-p3/recording-result.json) · [Manifest SHA256](evidence-manifest.json). Media trong output không nằm trong Git; bàn giao cả thư mục output/w6-p3 cùng manifest.\n';
    await fs.writeFile(path.join(docs, 'TIMELINE.md'), timeline);
  }
  for (const file of ['commits.json', 'commits.csv', 'prs.json', 'CONTRIBUTIONS.md', 'TIMELINE.md', 'REVIEW_RELEASE.md', 'README.md']) await add('docs/testing/w6-p3/' + file, 'W6-P3', 'EVIDENCE_INDEX_OR_REVIEW', null, 'UNCOMMITTED_W6_P3_DOCUMENT');
  await add('docs/weekly/WEEK_06_W6_P3.md', 'W6-P3', 'HANDOFF_REPORT', null, 'UNCOMMITTED_W6_P3_DOCUMENT');
  await add('docs/api/AWARDS_W2_P2.md', 'W6-P3', 'API_USAGE_MULTIPART_ERRATUM', null, 'UNCOMMITTED_W6_P3_DOCUMENT');
  await add('scripts/w6-p3-verify-video.mjs', 'W6-P3', 'VIDEO_DECODER_SOURCE', null, 'UNCOMMITTED_W6_P3_SOURCE');
  await add('frontend/src/services/awardsApi.js', 'W6-P3', 'NECESSARY_MULTIPART_UPLOAD_FIX', null, 'UNCOMMITTED_W6_P3_SOURCE');
  await fs.writeFile(path.join(docs, 'evidence-manifest.json'), JSON.stringify({ task: 'W6-P3', baselineCommit, createdAt: timestamp, runCommittedSha: null, recordingCodeBaselineCommit: result?.baselineCommit || null, releaseTargetDate: '2026-10-28', releaseStatus: 'PENDING_JOINT_REVIEW_AND_RESTORE', recordingStatus: result?.status || 'NOT_RUN', videoValidationStatus: validation?.status || 'NOT_RUN', recordingSourceHashes: result?.sourceHashes || [], mediaPolicy: 'Local ignored output; synthetic data only. No tokens/env/dumps exported. Copy the output folder with this manifest when handing off; clone alone has no video.', artifacts }, null, 2));
  console.log(`W6-P3 exported ${commits.length} commits/${authors.length} exact author names, ${prs.length} local PR references, ${artifacts.length} artifact hashes; remote ${failure || 'probe completed'}`);
}
