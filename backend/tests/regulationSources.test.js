import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import PizZip from 'pizzip';
import { extractSourceText, validateSource, sourcePath, regulationStorageRoot, validateSuggestions, MAX_SOURCE_BYTES, splitSourceForAI, proposeSourceCriteria } from '../src/modules/regulationSources.js';
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function word(xml) {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' });
}
function pdf(text) {
  const content = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let data = '%PDF-1.4\n', offsets = [0];
  objects.forEach((value, index) => { offsets.push(Buffer.byteLength(data)); data += `${index + 1} 0 obj\n${value}\nendobj\n`; });
  const xref = Buffer.byteLength(data);
  data += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(data);
}
test('Word extraction preserves Unicode, entities, paragraphs and tabs', async () => {
  const bytes = word('<w:document><w:p><w:r><w:t>Điều 1 &amp; &#x1EA1; &lt;nguồn&gt;</w:t><w:tab/><w:t>2 bài</w:t></w:r></w:p><w:p><w:t>Tiếp theo</w:t></w:p></w:document>');
  assert.equal(await extractSourceText(bytes, docxMime), 'Điều 1 & ạ <nguồn>\t2 bài\nTiếp theo');
});
test('Word external entities and malformed archives are rejected', async () => {
  await assert.rejects(extractSourceText(word('<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><w:t>&secret;</w:t>'), docxMime));
  await assert.rejects(extractSourceText(Buffer.from('bad zip'), docxMime));
  await assert.rejects(extractSourceText(word('<w:document/>'), docxMime));
});
test('PDF extraction reads actual page text and rejects blank/image-only PDF', async () => {
  assert.match(await extractSourceText(pdf('Required two publications'), 'application/pdf'), /\[Trang 1\][\s\S]*Required two publications/);
  await assert.rejects(extractSourceText(pdf(''), 'application/pdf'), /OCR|văn bản/);
  await assert.rejects(extractSourceText(Buffer.from('%PDF-broken'), 'application/pdf'));
});
test('source validates type, bytes and 10 MB limit; storage keys cannot traverse', () => {
  assert.throws(() => validateSource({ originalname: 'fake.pdf', buffer: Buffer.from('not pdf') }));
  assert.throws(() => validateSource({ originalname: 'big.pdf', buffer: Buffer.alloc(MAX_SOURCE_BYTES + 1) }));
  assert.throws(() => validateSource({ originalname: 'photo.png', buffer: Buffer.from([137,80,78,71,13,10,26,10]) }));
  const valid = validateSource({ originalname: '../../safe.pdf', buffer: pdf('source') });
  assert.equal(valid.name, 'safe.pdf');
  assert.equal(path.dirname(sourcePath(valid.key)), regulationStorageRoot);
  for (const key of ['../../secret.pdf','/tmp/source.pdf','x.docx','abc.png','abc.pdf/../../x']) assert.throws(() => sourcePath(key));
});
test('AI suggestions require real quotes and valid evaluator rules', () => {
  const input = { criteria: [{ code: 'TWO', title: 'Two papers', source_reference: 'Article 1', source_quote: 'Required two publications', rule: { type: 'count', target: 2 }, is_required: true, is_exclusion: false }], applicability: {}, manual_review: [], unsupported: [] };
  assert.equal(validateSuggestions(input, 'Article 1: Required two\npublications.').criteria.length, 1);
  assert.throws(() => validateSuggestions(input, 'No requirement exists.'), /căn cứ/);
  assert.throws(() => validateSuggestions({ ...input, criteria: [{ ...input.criteria[0], rule: { type: 'invented', target: 2 } }] }, input.criteria[0].source_quote));
  assert.throws(() => validateSuggestions({ ...input, criteria: [input.criteria[0], input.criteria[0]] }, input.criteria[0].source_quote), /trùng/);
});

test('long Vietnamese AI sources stay below gateway request and token limits without losing grounded clauses',async()=>{
 const text=('Điều 1: Hoàn thành ít nhất 2 hoạt động tình nguyện.\n').repeat(900),chunks=splitSourceForAI(text);
 assert.equal(chunks.join(''),text);assert.ok(chunks.length>1);assert.ok(chunks.every(c=>Buffer.byteLength(c,'utf8')<=30000));
 let calls=0;const provider={isPool:true,name:'fixture',async complete(args){calls++;assert.equal(args.maxTokens,2048);assert.ok(Buffer.byteLength(JSON.stringify({messages:[{role:'system',content:args.systemPrompt},{role:'user',content:args.prompt}]}),'utf8')<65536);return {provider:'fixture',model:'fixture',content:JSON.stringify({criteria:[{code:'COUNT',title:'Hai hoạt động',source_reference:'Điều 1',source_quote:'Hoàn thành ít nhất 2 hoạt động tình nguyện.',rule:{type:'count',target:2},is_required:true,is_exclusion:false}],applicability:{person_types:['STUDENT']},manual_review:[],unsupported:[]})};}};
 const result=await proposeSourceCriteria(text,{provider});assert.equal(calls,chunks.length);assert.equal(result.criteria.length,chunks.length);assert.equal(new Set(result.criteria.map(c=>c.code)).size,chunks.length);assert.equal(result.requiresReview,true);
});
