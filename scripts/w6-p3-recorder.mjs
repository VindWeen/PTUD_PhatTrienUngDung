// Real Chromium CDP screencast, encoded continuously by browser MediaRecorder.
// No external service, ffmpeg install, request bodies, cookies or tokens in media/logs.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function startScreenRecording(browser, page, output) {
  const encoder = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await encoder.setContent('<canvas width="1280" height="720"></canvas>');
  await encoder.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eef3f8'; ctx.fillRect(0, 0, 1280, 720);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) throw new Error('WebM recording codec unavailable');
    const chunks = [], stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1600000 });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    window.recording = { recorder, chunks, mimeType, ctx, canvas, stream };
    recorder.start(1000);
    window.recording.timer = setInterval(() => ctx.drawImage(canvas, 0, 0), 1000 / 12);
  });
  const session = await page.context().newCDPSession(page);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let queue = Promise.resolve(), frames = 0, frameFailures = 0;
  session.on('Page.screencastFrame', event => {
    session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    queue = queue.then(async () => {
      await encoder.evaluate(data => new Promise((resolve, reject) => {
        const img = new Image(); img.onload = () => { window.recording.ctx.drawImage(img, 0, 0, 1280, 720); resolve(); };
        img.onerror = reject; img.src = 'data:image/jpeg;base64,' + data;
      }), event.data);
      frames++;
    }).catch(() => { frameFailures++; });
  });
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  return {
    elapsed: () => (Date.now() - startedMs) / 1000,
    async stop() {
      await session.send('Page.stopScreencast');
      await queue;
      const result = await encoder.evaluate(() => new Promise(resolve => {
        const r = window.recording;
        r.recorder.onstop = async () => {
          clearInterval(r.timer); r.stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(r.chunks, { type: r.mimeType });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          resolve({ data: btoa(binary), mimeType: r.mimeType });
        };
        r.recorder.stop();
      }));
      const bytes = Buffer.from(result.data, 'base64');
      await fs.writeFile(output, bytes);
      await encoder.close(); await session.detach();
      assert.ok(frames > 20 && bytes.length > 10000, 'Recording must contain actual browser frames');
      assert.equal(frameFailures, 0, 'Every screencast frame encoded');
      return { startedAt, finishedAt: new Date().toISOString(), wallDurationSeconds: (Date.now() - startedMs) / 1000, frames, frameFailures, bytes: bytes.length, mimeType: result.mimeType, audio: 'NONE; Vietnamese on-screen captions', method: 'continuous CDP screencast + browser MediaRecorder, original elapsed time' };
    },
  };
}
