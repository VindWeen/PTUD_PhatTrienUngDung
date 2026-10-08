import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
for (const file of ['w4-p1.integration.js','w4-p2.integration.js','w3-p2.integration.js']) {
 const result=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{stdio:'inherit'});
 if(result.status!==0) process.exit(result.status || 1);
}
