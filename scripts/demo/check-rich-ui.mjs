// Real browser smoke check against the running 5175 demo; no mocked HTTP routes.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/fw622/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const manifest=JSON.parse(fs.readFileSync('output/rich-demo/manifest.json','utf8'));
const live=process.argv.includes('--live');
fs.mkdirSync('output/rich-demo/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],responses=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',async r=>{if(r.url().endsWith('/ai/rag/explain')&&r.status()===200){responses.push((await r.json()).data);}});
try {
 await page.goto('http://127.0.0.1:5175/login');
 await page.getByRole('textbox',{name:'Tên đăng nhập hoặc email'}).fill('an.nv');
 await page.getByRole('textbox',{name:'Mật khẩu',exact:true}).fill('demo1234');
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.waitForURL('**/me/dashboard');
 await page.screenshot({path:'output/rich-demo/screenshots/01-dashboard.png',fullPage:true});
 await page.goto('http://127.0.0.1:5175/me/ai-forecast');
 await page.locator('label').filter({hasText:'DEMO-CO-BAN'}).waitFor();
 if(!live){await page.getByText('Tùy chọn kỹ thuật · nguồn giải thích AI',{exact:true}).click();await page.locator('#ai-explanation-provider').click();await page.getByRole('option',{name:'Mô phỏng bằng câu trả lời mẫu',exact:true}).click();}
 const criteria=manifest.criteria.filter(c=>c.confirmed);
 // Select the three intentionally prepared cases by visible names, not hidden app state.
 const checkboxes=page.locator('input[type=checkbox]');
 for(const box of await checkboxes.all())await box.uncheck();
 for(const c of criteria) {
   const row=page.locator('label').filter({hasText:c.code});
   await row.locator('input[type=checkbox]').check();
 }
 await page.getByRole('button',{name:'Kiểm tra & phân tích bằng AI',exact:true}).click();
 await page.waitForFunction(isLive=>document.querySelector('[data-evaluation-summary]')?.textContent.includes(isLive?'3/3':'3 mục mô phỏng'),live,{timeout:90000});
 const summary=await page.locator('[data-evaluation-summary]').innerText();
 const outcomes=await page.locator('[data-criterion-selector]').allTextContents();
 assert.ok(outcomes[0].includes('Đạt')&&outcomes[1].includes('Chưa đạt')&&outcomes[2].includes('Chưa thể kết luận'));
 assert.equal(responses.length,3);
 assert.ok(responses.every(r=>r.isMock===!live&&r.citations.length>0&&r.isSufficientData),'all explanations must have correct mode and verified citations');
 await page.screenshot({path:'output/rich-demo/screenshots/02-ai-results.png',fullPage:true});
 await page.goto('http://127.0.0.1:5175/me/cv');
 await page.getByRole('heading',{name:'Chia sẻ CV',exact:true}).waitFor();
 await page.screenshot({path:'output/rich-demo/screenshots/03-cv-editor.png',fullPage:true});
 const previewEvent=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Xem trước trong tab mới',exact:true}).click();
 const preview=await previewEvent;
 await preview.getByText('Nguyễn Văn An',{exact:true}).first().waitFor();
 await preview.screenshot({path:'output/rich-demo/screenshots/04-cv-preview.png',fullPage:true});
 const publicId=manifest.cvs.find(c=>c.published).publicId;
 const publicContext=await browser.newContext({viewport:{width:1440,height:1000}}),publicPage=await publicContext.newPage();
 await publicPage.goto('http://127.0.0.1:5175/cv/'+publicId);
 await publicPage.getByText('Nguyễn Văn An',{exact:true}).first().waitFor();
 await publicPage.screenshot({path:'output/rich-demo/screenshots/05-public-cv.png',fullPage:true});
 await publicContext.close();
 assert.deepEqual(errors,[]);
 const report={success:true,checkedAt:new Date().toISOString(),url:'http://127.0.0.1:5175',loginThroughUI:true,aiThreeCasesVisible:true,liveAI:live,explanations:responses.map(r=>({provider:r.provider,model:r.model,isMock:r.isMock,citations:r.citations.length})),cvEditor:true,cvPreview:true,publicCvWithoutLogin:true,pageErrors:errors,summary};
 fs.writeFileSync('docs/testing/RICH_DEMO_BROWSER.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}


