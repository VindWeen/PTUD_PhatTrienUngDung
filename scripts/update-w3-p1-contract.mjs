import fs from 'node:fs';
const positive = {type:'integer',minimum:1};
const params = {kind:{type:'string',enum:['ACHIEVEMENT','AWARD']},subjectType:{type:'string',enum:['LECTURER','UNIT']},recognitionYear:{type:'integer',minimum:1990,maximum:2100},academicYearId:positive,contextUnitId:positive,typeId:positive,status:{type:'string',enum:['DRAFT','SUBMITTED','NEED_CORRECTION','VERIFIED','REJECTED','CANCELLED','REVOKED','RECORDED']},search:{type:'string',maxLength:200},page:{...positive,default:1},pageSize:{...positive,maximum:100,default:20}};
const queryParams = Object.entries(params).map(([name,schema])=>({name,in:'query',schema}));
const row = {type:'object',required:['kind','id','subject_type','title','status','is_valid'],properties:{kind:params.kind,id:{type:'string',description:'PostgreSQL BIGINT as decimal string'},lecturer_id:{type:'string',nullable:true},unit_id:{type:'string',nullable:true},context_unit_id:{type:'string'},context_unit_name:{type:'string'},subject_type:params.subjectType,subject_name:{type:'string'},title:{type:'string'},type_id:{type:'string'},type_name:{type:'string'},recognition_year:{type:'integer'},academic_year_id:{type:'string',nullable:true},academic_year_code:{type:'string',nullable:true},status:params.status,is_valid:{type:'boolean'},decision_number:{type:'string',nullable:true}}};
const aggregate = {type:'object',required:['kind','subject_type','total','valid_count','distinct_years'],properties:{kind:params.kind,subject_type:params.subjectType,total:{type:'integer'},valid_count:{type:'integer'},distinct_years:{type:'integer',description:'Distinct recognition years of valid rows per kind and subject type; not an eligibility rule'}}};
const response = {type:'object',required:['success','data'],properties:{success:{type:'boolean'},data:{type:'object',required:['total','items','summary','page','pageSize'],properties:{total:{type:'integer'},items:{type:'array',items:row},summary:{type:'array',items:aggregate},page:positive,pageSize:positive}}}};
const op=(csv=false)=>({summary:csv?'Xuất toàn bộ báo cáo theo cùng scope/filter; chống CSV formula injection':'Thống kê và tìm kiếm SQL theo đơn vị lịch sử',description:'Roles and scope read from active DB assignments, never JWT role claims. VERIFIED achievements and RECORDED awards are separate. REVOKED is invalid. typeId requires kind. academicYearId filters achievements only; kind=AWARD plus academicYearId returns 400. Legacy awards without decision metadata are excluded. CSV requires representative/manager/records officer/admin; pagination ignored for CSV. Each response uses one SQL snapshot.',tags:['Reports'],security:[{bearerAuth:[]}],parameters:queryParams,responses:{'200':{description:csv?'UTF-8 BOM, CRLF, quoted CSV; all matching rows, attachment':'Success envelope; aggregates across all pages',content:csv?{'text/csv':{schema:{type:'string',format:'binary'}}}:{'application/json':{schema:response}}},'400':{description:'Invalid or ambiguous filters'},'401':{description:'Authentication or active user required'},'403':{description:'Active role/export permission required'}}});
const paths={};
for(const path of ['/dashboard/summary','/reports','/reports/achievements','/reports/awards']) paths[path]={get:op()};
for(const path of ['/reports/export.csv','/reports/export']) paths[path]={get:op(true)};
for(const path of ['/reports/achievements','/reports/awards','/reports/export']) paths[path].get.parameters=[...queryParams,{name:'unitId',in:'query',schema:positive,description:'Legacy alias of contextUnitId, not current lecturer unit'}];
paths['/reports/export'].get.parameters.push({name:'type',in:'query',schema:{type:'string',enum:['achievements','awards']},description:'Legacy alias of kind'});
const spec={openapi:'3.0.3',info:{title:'W3-P1 Reports',version:'1.0.0'},servers:[{url:'/api/v1'}],paths,components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}}}};
fs.writeFileSync('docs/api/W3_P1.openapi.json',JSON.stringify(spec,null,2)+'\n');
// Update only W3-P1 path values and preserve formatting of every other owner's contract.
let source=fs.readFileSync('docs/api/openapi.json','utf8');
const base=JSON.parse(source);
let yaml=fs.readFileSync('docs/api/openapi.yaml','utf8');
for(const key of Object.keys(paths)) {
 const ref='./W3_P1.openapi.json#/paths/'+key.replaceAll('~','~0').replaceAll('/','~1');
 const replacement=JSON.stringify({$ref:ref});
 if(base.paths[key]) {
  const start=source.indexOf(JSON.stringify(key)+':');
  const valueStart=source.indexOf('{',start+JSON.stringify(key).length+1);
  let depth=0,quoted=false,escaped=false,end=valueStart;
  for(;end<source.length;end++){const ch=source[end];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}else if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){end++;break;}}
  source=source.slice(0,valueStart)+replacement+source.slice(end);
 } else {const point=source.indexOf('"paths": {')+'"paths": {'.length;source=source.slice(0,point)+'\n    '+JSON.stringify(key)+': '+replacement+','+source.slice(point);}
 const label='  '+key+':';const newYaml=label+"\n    $ref: '"+ref+"'\n\n";const start=yaml.indexOf(label);
 if(start>=0){const tail=yaml.slice(start+label.length);const match=/\n  \/|\ncomponents:/.exec(tail);const end=match?start+label.length+match.index+1:yaml.length;yaml=yaml.slice(0,start)+newYaml+yaml.slice(end);}else yaml=yaml.replace('paths:\n','paths:\n'+newYaml);
}
fs.writeFileSync('docs/api/openapi.json',source);
fs.writeFileSync('docs/api/openapi.yaml',yaml);
