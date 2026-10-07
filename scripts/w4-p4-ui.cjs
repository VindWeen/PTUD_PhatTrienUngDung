const fs = require('fs');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.W4_PLAYWRIGHT_PATH);
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 const context = await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(); let mode='loading'; let release;
 const gate=new Promise(r=>release=r);
 const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data,...(status>=400?{error:{code:'TEST_ERROR',message:'Synthetic error'}}:{})})});
 await page.route('**/api/v1/**',async route=>{
  const u=route.request().url();
  if(u.endsWith('/auth/refresh')) return reply(route,{accessToken:'SYNTHETIC-NOT-A-REAL-TOKEN'});
  if(u.endsWith('/auth/me')) return reply(route,{userId:999,displayName:'SYNTHETIC UI TEST',roles:['LECTURER'],lecturerProfile:{LecturerId:999}});
  if(u.includes('/regulations/criteria')) {if(mode==='loading') await gate; return mode==='error'?reply(route,null,503):reply(route,[{criteria_version_id:77,criterion_code:'SYNTHETIC-77',name:'Tiêu chí mô phỏng kiểm thử'}]);}
  if(u.includes('/ai/evaluations/structured')) return reply(route,{runId:'synthetic-run',targetSubject:{subjectType:'LECTURER',subjectId:999},overallStatus:'SIMULATION',overallConclusion:'SIMULATION_ONLY',providerInfo:{provider:'mock',isMock:true},inputHash:'a'.repeat(64),criterionResults:[{criterionId:77,criterionCode:'SYNTHETIC-77',criterionName:'Mô phỏng kiểm thử',thresholdMetric:{targetMin:3,actualRecorded:1,isSatisfied:false},aiAnalysis:'Thiếu minh chứng tổng hợp; yêu cầu rà soát.',humanReviewRequired:true}]});
  if(u.includes('/ai/rag/explain')) return reply(route,{isMock:true,isSufficientData:false,providerError:'PROVIDER_UNAVAILABLE',explanationText:'Mô phỏng lỗi quota; cần rà soát thủ công.',citations:[],model:'synthetic',promptVersion:'test'});
  return reply(route,[]);
 });
 await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {const b=document.createElement('div');b.textContent='W4-P4: SYNTHETIC UI FIXTURE';b.style='position:fixed;top:0;right:0;background:#ffef99;color:#111;z-index:99999;font-size:12px';document.body.append(b)}));
 await page.goto('http://127.0.0.1:5173/me/ai-forecast');
 await page.getByRole('heading',{name:/Phân tích & Thẩm định/}).waitFor();
 await page.evaluate(()=>{const b=document.createElement('div');b.textContent='W4-P4 — SYNTHETIC UI FIXTURE — KHÔNG PHẢI TÍCH HỢP THẬT';b.style='position:fixed;bottom:0;left:0;right:0;background:#ffef99;color:#111;z-index:99999;font-size:12px';document.body.append(b)});
 assert.equal(await page.getByRole('button',{name:'Thực hiện Thẩm định AI',exact:true}).isDisabled(),true);
 await page.screenshot({path:'docs/testing/week-4/media/mobile-loading.png',fullPage:true});
 mode='error'; release();
 await page.getByRole('alert').filter({hasText:'Không tải được tiêu chí'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Thực hiện Thẩm định AI',exact:true}).isDisabled(),true);
 assert.equal(await page.getByText('CSTĐCS-01',{exact:true}).count(),0);
 await page.screenshot({path:'docs/testing/week-4/media/mobile-error.png',fullPage:true});
 mode='ok';await page.reload();await page.getByText('SYNTHETIC-77',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Thực hiện Thẩm định AI',exact:true}).click();
 await page.getByRole('button',{name:/Giải thích/}).click();
 await page.getByText(/Provider lỗi hoặc hết quota/).waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 assert.equal(overflow,false);
 await page.getByText('Chỉ mô phỏng',{exact:true}).waitFor();
 await page.screenshot({path:'docs/testing/week-4/media/mobile-quota.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'docs/testing/week-4/media/desktop-quota.png',fullPage:true});
 fs.writeFileSync('docs/testing/week-4/ui-result.json',JSON.stringify({synthetic:true,states:['loading','criteria-error','quota','missing-data'],mobileWidth:390,horizontalOverflow:overflow},null,2));
 await context.close();await browser.close();console.log('UI fixture states captured; horizontalOverflow='+overflow);
})().catch(e=>{console.error(e);process.exit(1)});


