// Decode and seek the actual local WebM in Edge; save frames for visual inspection.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
assert.ok(process.env.W6_PLAYWRIGHT_PATH, 'Set W6_PLAYWRIGHT_PATH');
const { chromium } = require(process.env.W6_PLAYWRIGHT_PATH);
const dir = 'output/w6-p3';
const result = JSON.parse(await fs.readFile(`${dir}/recording-result.json`, 'utf8'));
assert.equal(result.status, 'PASS', 'Do not accept an incomplete recording');
const bytes = await fs.readFile(`${dir}/demo.webm`);
assert.equal(bytes.readUInt32BE(0), 0x1a45dfa3, 'WebM EBML signature');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent('<style>body{margin:0;background:black}video{width:1280px;height:720px;object-fit:contain}</style><video muted playsinline></video>');
  const metadata = await page.evaluate(async data => {
    const video = document.querySelector('video');
    const blob = await (await fetch('data:video/webm;base64,' + data)).blob();
    video.src = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Video decode failed')); });
    return { width: video.videoWidth, height: video.videoHeight, duration: Number.isFinite(video.duration) ? video.duration : 'UNINDEXED_WEBM_USE_RECORDED_ELAPSED_TIME' };
  }, bytes.toString('base64'));
  assert.equal(metadata.width, 1280); assert.equal(metadata.height, 720);
  const frames = [];
  for (const id of ['individual-submitted', 'recommended', 'recorded', 'release-gates']) {
    const step = result.steps.find(s => s.id === id); assert.ok(step, id);
    const time = step.atSeconds + 1;
    await page.evaluate(async time => {
      const video = document.querySelector('video');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video seek timeout')), 15000);
        video.onseeked = () => { clearTimeout(timeout); resolve(); }; video.currentTime = time;
      });
    }, time);
    await page.screenshot({ path: `${dir}/playback-${id}.png` });
    frames.push({ id, seekSeconds: time, status: 'DECODED', path: `${dir}/playback-${id}.png` });
  }
  const validation = { task: 'W6-P3', status: 'PASS', baselineCommit: result.baselineCommit, metadata, elapsedSeconds: result.recording.wallDurationSeconds, bytes: bytes.length, frames, method: 'Edge decodes local WebM and seeks actual recorded frames; no still-image reconstruction' };
  await fs.writeFile(`${dir}/video-validation.json`, JSON.stringify(validation, null, 2));
  console.log('W6-P3 video decode PASS: 1280x720, four timeline seeks');
} finally { await browser.close(); }
