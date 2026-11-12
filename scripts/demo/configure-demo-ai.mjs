// Store only a mode flag. Credentials remain in the existing server-side source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from '../../backend/node_modules/dotenv/lib/main.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=path.join(root,'backend/.env.demo');
const demo=dotenv.parse(fs.readFileSync(target));
if(demo.DB_NAME!=='PTUD_LHU_Demo')throw new Error('Only isolated demo environment allowed');
const live=process.argv.includes('--live'),mock=process.argv.includes('--mock');
if(live===mock)throw new Error('Choose exactly --live or --mock');
const values={DEMO_AI_MODE:live?'live':'mock',AI_PROVIDER:'mock',AI_POOL_URL:'',AI_POOL_TOKEN:''};
let text=fs.readFileSync(target,'utf8');
for(const [key,value] of Object.entries(values)) {
 const line=key+'='+JSON.stringify(value),pattern=new RegExp('^'+key+'=.*$','m');
 text=pattern.test(text)?text.replace(pattern,()=>line):text.trimEnd()+'\n'+line+'\n';
}
fs.writeFileSync(target,text);
console.log('Demo AI mode: '+(live?'live pool':'mock')+'. Restart only npm run demo backend. No secrets printed.');
