// Regenerate only W2-P2 contract paths; preserve other owners' API contracts.
import fs from 'node:fs';
const target = new URL('../docs/api/openapi.json', import.meta.url);
let source = fs.readFileSync(target,'utf8');
const base = JSON.parse(source);
const spec = { paths: {} };
const integer = {type:'integer',minimum:1};
const string = {type:'string'};
const body = schema => ({required:true,content:{'application/json':{schema}}});
const object = (properties,required) => ({type:'object',additionalProperties:false,properties,required});
const param = {name:'id',in:'path',required:true,schema:integer};
const response = {description:'Success envelope; DB BIGINT IDs/version are decimal strings.',content:{'application/json':{schema:{type:'object',properties:{success:{type:'boolean'},data:{type:'object',description:'Snake_case database fields; detail adds decision, files, histories, achievementIds.'}}}}}};
const operation = (summary,requestBody,created=false) => ({summary,tags:['Awards'],security:[{bearerAuth:[]}],...(requestBody ? {requestBody} : {}),responses:{[created ? '201':'200']:response,'400':{description:'Validation'},'403':{description:'Active RecordsOfficer role/scope required'},'404':{description:'Not found'},'409':{description:'State/version/duplicate conflict'}}});
spec.paths['/award-decisions']={post:operation('Nhập quyết định đã ban hành',body(object({decisionNumber:{...string,minLength:1,maxLength:100},decisionDate:{type:'string',format:'date'},issuer:{...string,minLength:1,maxLength:150},title:{...string,minLength:1,maxLength:255}},['decisionNumber','decisionDate','issuer','title'])),true)};
spec.paths['/award-records']={get:{...operation('Danh sách trong scope đơn vị'),parameters:[{name:'contextUnitId',in:'query',required:true,schema:integer},{name:'page',in:'query',schema:integer},{name:'pageSize',in:'query',schema:{...integer,maximum:100}}]},post:operation('Tạo DRAFT; XOR chủ thể, lấy ContextUnitId từ DB',body(object({lecturerId:integer,organizationUnitId:integer,awardTypeId:integer,decisionId:integer,recognitionYear:{type:'integer',minimum:1990,maximum:2100},achievementIds:{type:'array',maxItems:100,items:integer},replacesAwardRecordId:integer},['awardTypeId','decisionId','recognitionYear'])),true)};
spec.paths['/award-records/{id}']={parameters:[param],get:operation('Chi tiết và lịch sử theo scope')};
for(const action of ['record','revoke']) spec.paths[`/award-records/{id}/${action}`]={parameters:[param],post:operation(action==='record'?'DRAFT → RECORDED, yêu cầu file private':'RECORDED → REVOKED, yêu cầu lý do',body(object({version:integer,reason:{...string,maxLength:1000}},action==='record'?['version']:['version','reason'])))};
spec.paths['/award-decisions/{id}/files']={parameters:[param],post:operation('Upload version bất biến; khóa sau khi quyết định được sử dụng',{required:true,content:{'multipart/form-data':{schema:object({file:{type:'string',format:'binary'}},['file'])}}},true)};
spec.paths['/award-decision-files/{id}/download']={parameters:[param],get:{...operation('Download private, kiểm tra scope'),responses:{'200':{description:'Private attachment',content:{'application/octet-stream':{schema:{type:'string',format:'binary'}}}},'403':{description:'Out of scope'},'404':{description:'Missing file'}}}};
fs.writeFileSync(new URL('../docs/api/W2_P2.openapi.json',import.meta.url),JSON.stringify({openapi:'3.0.3',info:{title:'W2-P2 Awards',version:'1.0.0'},paths:spec.paths},null,2)+'\n');
for(const key of Object.keys(spec.paths)) {
 const replacement = JSON.stringify({$ref:`./W2_P2.openapi.json#/paths/${key.replaceAll('~','~0').replaceAll('/','~1')}`});
 if(base.paths[key]) {
  const start=source.indexOf(JSON.stringify(key)+':');
  const valueStart=source.indexOf('{',start+JSON.stringify(key).length+1);
  let depth=0,quoted=false,escaped=false,end=valueStart;
  for(;end<source.length;end++) {const ch=source[end];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}else if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}' && --depth===0){end++;break;}}
  source=source.slice(0,valueStart)+replacement+source.slice(end);
 } else {
  const point=source.indexOf('"paths": {')+'"paths": {'.length;
  source=source.slice(0,point)+`\n    ${JSON.stringify(key)}: ${replacement},`+source.slice(point);
 }
}
fs.writeFileSync(target,source);
const yamlTarget=new URL('../docs/api/openapi.yaml',import.meta.url);
let yaml=fs.readFileSync(yamlTarget,'utf8');
for(const key of Object.keys(spec.paths)) {
 const label=`  ${key}:`;
 const replacement=`${label}\n    $ref: './W2_P2.openapi.json#/paths/${key.replaceAll('~','~0').replaceAll('/','~1')}'\n\n`;
 const start=yaml.indexOf(label);
 if(start>=0) {const tail=yaml.slice(start+label.length);const match=/\n  \/|\ncomponents:/.exec(tail);const end=match ? start+label.length+match.index+1 : yaml.length;yaml=yaml.slice(0,start)+replacement+yaml.slice(end);} else {yaml=yaml.replace('paths:\n','paths:\n'+replacement);}
}
fs.writeFileSync(yamlTarget,yaml);
