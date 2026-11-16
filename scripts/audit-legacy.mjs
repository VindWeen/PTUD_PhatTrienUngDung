// Read-only dependency evidence for removing superseded approval implementation.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const walk=directory=>fs.existsSync(directory)?fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]):[];
const relative=file=>path.relative(root,file).replaceAll('\\','/');
const roots=['backend/src/app.js','backend/src/server.js','scripts/backup.mjs','scripts/restore.mjs','database/scripts/migrate.js','database/scripts/seed.js',...walk('backend/src/v2'),...walk('backend/tests').filter(file=>/v2-|fileName/.test(file))].filter(file=>/\.(js|mjs)$/.test(file));
const visited=new Set();
function visit(file){
 file=path.resolve(file);if(visited.has(file)||!fs.existsSync(file)||!file.startsWith(root+path.sep))return;visited.add(file);
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g))visit(path.resolve(path.dirname(file),match[2]));
}
roots.forEach(visit);
const pattern=/\b(?:COUNCIL|RECORDS_OFFICER|UNIT_REPRESENTATIVE|MANAGER|SelfApprovalError|antiSelfApproval|award_applications|award_records|achievement_submissions|achievement_verifications|SUBMITTED|VERIFIED|NEED_CORRECTION)\b|xét duyệt|Hội đồng|thẩm định viên/g;
const candidates=[...walk('backend/src/modules'),...walk('backend/src/middlewares'),...walk('backend/tests')].filter(file=>/\.js$/.test(file)&&!visited.has(path.resolve(file)));
const records=candidates.flatMap(file=>{
 const matches=[...new Set(fs.readFileSync(file,'utf8').match(pattern)||[])];
 return matches.length?[{path:relative(path.resolve(file)),approvalMarkers:matches.slice(0,12),reachableFromActiveEntrypoints:false}]:[];
});
// Include only callers of removed approval files, so no retained backend source has
// a broken import. This does not authorize deleting database history or other assets.
const removed=new Set(records.map(record=>path.resolve(record.path)));
let changed=true;
while(changed){changed=false;for(const file of candidates){
 const absolute=path.resolve(file);if(removed.has(absolute))continue;
 const imports=[...fs.readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)].map(match=>path.resolve(path.dirname(absolute),match[2]));
 const broken=imports.find(dependency=>removed.has(dependency));
 if(broken){removed.add(absolute);records.push({path:relative(absolute),reason:'Superseded caller of removed approval implementation',removedDependency:relative(broken),reachableFromActiveEntrypoints:false});changed=true;}
}}
const report={activeEntrypoints:roots.map(file=>relative(path.resolve(file))),reachableFiles:[...visited].map(relative).sort(),candidates:records};
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/approval-removal-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({reachableFiles:visited.size,approvalCandidates:records.length,report:'output/approval-removal-audit.json',byDirectory:records.reduce((summary,record)=>{const key=record.path.split('/').slice(0,4).join('/');summary[key]=(summary[key]||0)+1;return summary;},{})},null,2));
