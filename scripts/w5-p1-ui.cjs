// UI state regression only: labelled synthetic responses, not DB E2E evidence.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.W5_PLAYWRIGHT_PATH||'playwright');
(async()=>{
 fs.mkdirSync('output/w5-p1/ui',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage();let mode='loading',release;
  const gate=new Promise(r=>release=r);
  const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data,...(status>=400?{error:{code:'SYNTHETIC_ERROR',message:'W5 SYNTHETIC lỗi tải báo cáo'}}:{})})});
  await page.route('**/api/v1/**',async route=>{
   const url=route.request().url();
   if(url.includes('/auth/refresh'))return reply(route,{accessToken:'SYNTHETIC'});
   if(url.includes('/auth/me'))return reply(route,{userId:1,displayName:'W5 SYNTHETIC',roles:['ADMIN']});
   if(url.includes('/reports')){if(mode==='loading')await gate;return mode==='error'?reply(route,null,503):reply(route,{total:mode==='populated'?5000:0,summary:[],items:mode==='populated'?Array.from({length:20},(_,i)=>({kind:'ACHIEVEMENT',id:String(i+1),subject_type:i%2?'UNIT':'LECTURER',subject_name:'W5 SYNTHETIC chủ thể',title:'Thành tích mô phỏng dài để kiểm tra giao diện responsive '+i,recognition_year:2026,status:'VERIFIED',is_valid:true})):[],page:1,pageSize:20});}
   return reply(route,[]);
  });
  const checks=[];
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:900});
   if(width===390){await page.goto('http://127.0.0.1:5173/reports');await page.getByRole('status').filter({hasText:'Đang đối soát'}).waitFor();await page.screenshot({path:`output/w5-p1/ui/loading-${width}.png`,fullPage:true});mode='error';release();}
   else{mode='error';await page.reload();}
   await page.getByRole('alert').filter({hasText:'W5 SYNTHETIC'}).waitFor();
   await page.screenshot({path:`output/w5-p1/ui/error-${width}.png`,fullPage:true});
   mode='empty';await page.getByRole('button',{name:'Thử lại',exact:true}).click();
   await page.getByText('Không có bản ghi nào',{exact:true}).waitFor();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   assert.equal(overflow,false,`horizontal overflow at ${width}px`);
   await page.screenshot({path:`output/w5-p1/ui/empty-${width}.png`,fullPage:true});checks.push({width,states:['error','retry','empty'],overflow});
   mode='populated';await page.reload();await page.getByText('Thành tích mô phỏng dài để kiểm tra giao diện responsive 0',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`populated overflow ${width}px`);
   await page.screenshot({path:`output/w5-p1/ui/populated-${width}.png`,fullPage:true});checks.at(-1).states.push('populated-20-rows');
  }
  fs.writeFileSync('output/w5-p1/ui/result.json',JSON.stringify({synthetic:true,loading:true,checks},null,2));console.log('PASS UI loading/error/retry/empty; 390/768/1440px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
