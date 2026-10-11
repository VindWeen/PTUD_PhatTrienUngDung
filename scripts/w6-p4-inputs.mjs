// W6-P4: collect only allowlisted, synthetic report inputs; never read env/storage.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/report-inputs/phuoc');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const json = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const manifestPath = path.join(out, 'manifest.json');
if (process.argv.includes('--verify')) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let failures = [];
  for (const a of m.assets) {
    for (const p of [a.source, a.copy].filter(Boolean)) {
      if (!fs.existsSync(path.join(root, p)) || sha(fs.readFileSync(path.join(root, p))) !== a.sha256) failures.push(p);
    }
  }
  for (const a of m.dependencySources) {
    if (sha(execFileSync('git', ['show', `${m.w6p3.commit}:${a.path}`], {cwd:root})) !== a.sha256) failures.push(a.path);
  }
  const perf = json('docs/report-inputs/phuoc/performance.json');
  for (const mode of ['load', 'overlapping']) {
    for (const a of perf[mode].measurements) {
      if (a.p95Ms !== a.recomputedP95Ms) failures.push(`p95 mismatch ${mode} ${a.path}`);
    }
  }
  if (git('rev-parse', 'HEAD') !== m.checkoutCommit) failures.push('HEAD changed: review release compatibility and regenerate');
  if (failures.length) throw new Error(`Evidence drift: ${failures.join(', ')}`);
  console.log(`PASS: ${m.assets.length} assets and ${m.dependencySources.length} dependency sources; release acceptance remains BLOCKED`);
  process.exit(0);
}
fs.mkdirSync(path.join(out, 'images'), {recursive:true});
const dependency = git('rev-parse', '3cb8789');
const recording = json('output/w6-p3/recording-result.json');
const recordedManifest = JSON.parse(execFileSync('git', ['show', `${dependency}:docs/testing/w6-p3/evidence-manifest.json`], {cwd:root, encoding:'utf8'}));
const dependencySources = ['README.md','REVIEW_RELEASE.md','TIMELINE.md','prs.json','evidence-manifest.json'].map(name => {
  const p = `docs/testing/w6-p3/${name}`;
  const b = execFileSync('git', ['show', `${dependency}:${p}`], {cwd:root});
  fs.mkdirSync(path.join(out,'dependency-w6-p3'),{recursive:true});
  const copy = `docs/report-inputs/phuoc/dependency-w6-p3/${name}`;
  fs.writeFileSync(path.join(root,copy),b);
  return {path:p, copy, sha256:sha(b), status:'OTHER_BRANCH_HISTORICAL'};
});
const files = ['docs/report-inputs/RELEASE_RECORD_W6Q3.json','docs/report-inputs/KNOWN_LIMITATIONS_W6Q3.md','docs/report-inputs/quang/TECHNICAL_HANDOFF_W6Q4.md','docs/testing/w5-p1/load-result.json','docs/testing/w5-p1/overlapping-load-result.json','docs/testing/w5-p1/browser-result.json','docs/ai/recommender-eval/results.json','docs/ai/evaluation/evaluation_run_results.json','docs/ai/evaluation/holdout_dataset.json','scripts/w5-q2-eval.mjs','frontend/src/services/kpiApi.js','backend/src/modules/kpi/recommendationService.js','output/w6-p3/recording-result.json'];
const assets = files.map(source => ({source, sha256:sha(fs.readFileSync(path.join(root,source))), status:'HISTORICAL_OR_CONTRACT'}));
for (const name of ['reports','verified','recommended','recorded','wrong-role','occ']) {
  const source = `output/w6-p3/images/${name}.png`;
  const b = fs.readFileSync(path.join(root,source));
  // Require P3's committed evidence to contain the same content hash.
  if (!JSON.stringify(recordedManifest).includes(sha(b))) throw new Error(`Unverified P3 media: ${source}`);
  const copy = `docs/report-inputs/phuoc/images/${name}.png`;
  fs.writeFileSync(path.join(root,copy),b);
  assets.push({source,copy,bytes:b.length,sha256:sha(b),status:'SYNTHETIC_REAL_API_OTHER_BRANCH_NOT_RELEASE'});
}
const compatibility = recording.sourceHashes.map(a => ({...a, matchesCheckout:fs.existsSync(path.join(root,a.path)) && sha(fs.readFileSync(path.join(root,a.path))) === a.sha256}));
const load = json('docs/testing/w5-p1/load-result.json');
const overlapping = json('docs/testing/w5-p1/overlapping-load-result.json');
const summary = d => ({startedAt:d.startedAt,synthetic:d.synthetic,concurrency:d.concurrency,machine:d.machine,dataset:d.dataset,measurements:d.measurements.map(a => ({path:a.path,requests:a.requests,p95Ms:a.p95Ms,targetMet:a.targetMet,recomputedP95Ms:[...a.samplesMs].sort((x,y)=>x-y)[Math.ceil(.95*a.samplesMs.length)-1]}))});
fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify({label:'HISTORICAL SYNTHETIC; NOT MEASURED ON RELEASE',load:summary(load),overlapping:summary(overlapping)},null,2)+'\n');
assets.push({source:'docs/report-inputs/phuoc/performance.json',sha256:sha(fs.readFileSync(path.join(out,'performance.json'))),status:'DERIVED_FROM_HISTORICAL_SAMPLES'});
for (const a of dependencySources) assets.push({source:a.copy,sha256:a.sha256,status:a.status});
let integrated = true;
try {git('merge-base','--is-ancestor',dependency,'HEAD');} catch {integrated=false;}
fs.writeFileSync(manifestPath,JSON.stringify({task:'W6-P4',owner:'Võ Nhạc Phước',generatedAt:new Date().toISOString(),checkoutCommit:git('rev-parse','HEAD'),releaseRecordCommit:json(files[0]).commitSHAFull,releaseTagPresent:git('tag','--list','v0.6-demo-ptud') !== '',acceptance:'BLOCKED_RELEASE_ALIGNMENT',w6p3:{commit:dependency,integrated,recordingBaseline:recording.baselineCommit,sourceCompatibility:compatibility},dependencySources,assets},null,2)+'\n');
console.log(`Collected ${assets.length} assets; W6-P3 integrated=${integrated}; media remains historical`);
