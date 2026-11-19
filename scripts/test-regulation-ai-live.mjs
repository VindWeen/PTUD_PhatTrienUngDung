// Explicit online smoke test. Sends only the fixed fictional text below.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { proposeSourceCriteria } from '../backend/src/modules/regulationSources.js';
if(!process.argv.includes('--run')){console.log('Usage: node scripts/test-regulation-ai-live.mjs --run (uses configured AI provider with fictional text only)');process.exit(0);}
const text='QUY CHẾ TỰ ĐẶT — DỮ LIỆU DEMO. Áp dụng cho sinh viên. Điều 1: Sinh viên hoàn thành ít nhất 2 hoạt động tình nguyện trong năm 2026. Mỗi hoạt động lưu loại VOLUNTEER trong thuộc tính category và ngày hoàn thành. Điều 2: Đây là đối chiếu hồ sơ tự khai, không công nhận danh hiệu.';
const result=await proposeSourceCriteria(text);
assert.ok(result.requiresReview);
assert.ok(result.criteria.length>0,'The live provider must propose at least one grounded criterion.');
assert.ok(result.criteria.some(c=>c.rule.type==='count'&&c.rule.target===2),'Demo quantitative requirement must remain two activities.');
assert.ok(result.criteria.every(c=>text.normalize('NFC').replace(/\s+/g,' ').includes(c.source_quote.normalize('NFC').replace(/\s+/g,' '))));
const report={verifiedAt:new Date().toISOString(),success:true,fictionalInputOnly:true,inputSha256:createHash('sha256').update(text).digest('hex'),provider:result.provider,model:result.model,requiresReview:result.requiresReview,criteria:result.criteria,applicability:result.applicability,manualReview:result.manual_review,unsupported:result.unsupported};
const directory=path.resolve('output/regulations');await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'ai-live-test.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,provider:report.provider,model:report.model,groundedCriteria:report.criteria.length,requiresReview:true,report:'output/regulations/ai-live-test.json'}));
