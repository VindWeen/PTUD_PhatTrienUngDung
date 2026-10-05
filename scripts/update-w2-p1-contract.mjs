import fs from 'node:fs';
const s = (maxLength) => ({ type:'string',minLength:1,maxLength });
const id = { type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER };
const bool = { type:'boolean' };
const date = { type:'string',format:'date' };
const datetime = { type:'string',format:'date-time' };
const period = { validFrom:datetime,validTo:{ ...datetime,nullable:true } };
const common = { code:{ ...s(50),description:'Chữ Unicode (giữ mã CSTĐ_CS đã chốt), số, dấu gạch và gạch dưới; chuẩn hóa chữ hoa.' },name:s(150),isActive:{ ...bool,default:true } };
const description = { type:'string',maxLength:500,nullable:true };
const subject = { type:'string',enum:['LECTURER','UNIT','BOTH'],default:'BOTH' };
const object = (properties,required) => ({ type:'object',additionalProperties:false,properties,required });
const schemas = {
  UserCreate:object({ username:{ ...s(50),pattern:'^[A-Za-z0-9_.-]+$' },email:{ type:'string',format:'email',maxLength:255 },displayName:s(100),password:{ type:'string',minLength:10,maxLength:72,writeOnly:true } },['username','email','displayName','password']),
  UserUpdate:object({ email:{ type:'string',format:'email',maxLength:255 },displayName:s(100),status:{ type:'string',enum:['ACTIVE','INACTIVE','LOCKED'] },version:id },['email','displayName','status','version']),
  RoleAssignment:object({ userId:id,roleId:id,unitId:id,includeDescendants:bool,...period },['userId','roleId','validFrom','validTo']),
  ScopeAssignment:object({ userId:id,roleId:id,unitId:id,includeDescendants:{ ...bool,default:false },...period },['userId','roleId','unitId','validFrom','validTo']),
  Representative:object({ userId:id,unitId:id,validFrom:datetime,validTo:datetime },['userId','unitId','validFrom','validTo']),
  AcademicYear:object({ ...common,code:{ ...common.code,maxLength:20 },name:s(100),startDate:date,endDate:date,isCurrent:{ ...bool,default:false } },['code','name','startDate','endDate']),
  AchievementType:object({ ...common,description,applicableSubjectType:subject },['code','name']),
  AwardType:object({ ...common,description,applicableSubjectType:subject,category:{ type:'string',enum:['TITLE','REWARD_FORM'] },level:{ type:'string',enum:['FACULTY','UNIVERSITY','MINISTRY','STATE'] } },['code','name','category','level']),
};
const ref = name => ({ $ref:`#/components/schemas/${name}` });
const response = list => ({ type:'object',required:['success','data'],properties:{ success:{ type:'boolean',enum:[true] },data: list ? { type:'array',maxItems:500,items:{ type:'object',additionalProperties:true } } : { type:'object',additionalProperties:true } } });
function operation(summary,schema,list=false,withId=false) {
  return { tags:['Admin W2-P1'],summary,description:'Yêu cầu ADMIN đang hiệu lực; backend đọc lại trạng thái và phân công từ DB. Request camelCase; dữ liệu trả về dùng tên cột snake_case, mutation thêm id. Ghi và audit cùng transaction.',security:[{ bearerAuth:[] }],...(withId ? { parameters:[{ in:'path',name:'id',required:true,schema:id }] } : {}),...(schema ? { requestBody:{ required:true,content:{ 'application/json':{ schema:ref(schema) } } } } : {}),responses:{ '200':{ description:'Thành công',content:{ 'application/json':{ schema:response(list) } } },'400':{ description:'VALIDATION_ERROR hoặc CONSTRAINT_VIOLATION' },'401':{ description:'UNAUTHORIZED; tài khoản không hoạt động / token không hợp lệ' },'403':{ description:'FORBIDDEN; thiếu ADMIN hiện tại' },'404':{ description:'NOT_FOUND' },'409':{ description:'DUPLICATE_RECORD, OVERLAPPING_HISTORY hoặc CONFLICT' } } };
}
const paths = {};
const resources = { users:'UserCreate',roles:null,'user-roles':'RoleAssignment',scopes:'ScopeAssignment',representatives:'Representative','academic-years':'AcademicYear','achievement-types':'AchievementType','award-types':'AwardType' };
for (const [resource,schema] of Object.entries(resources)) {
  paths[`/admin/${resource}`] = { get:operation(`Danh sách ${resource} (tối đa 500)`,null,true) };
  if (!schema) continue;
  paths[`/admin/${resource}`].post = operation(`Tạo / phân công ${resource}`,schema);
  const catalog = ['academic-years','achievement-types','award-types'].includes(resource);
  paths[`/admin/${resource}/{id}`] = resource === 'users' ? { patch:operation('Cập nhật tài khoản; INACTIVE/LOCKED thu hồi refresh token','UserUpdate',false,true) }
    : { ...(catalog ? { patch:operation(`Cập nhật ${resource}`,schema,false,true) } : {}),delete:operation(catalog ? 'Ngừng hoạt động; giữ tham chiếu, không DELETE vật lý' : 'Thu hồi tức thời; giữ nguyên thời hạn và lịch sử',null,false,true) };
}
const doc = { openapi:'3.0.3',info:{ title:'W2-P1 Admin API',version:'1.0.0' },servers:[{ url:'/api/v1' }],paths,components:{ schemas,securitySchemes:{ bearerAuth:{ type:'http',scheme:'bearer',bearerFormat:'JWT' } } } };
const folder = new URL('../docs/api/',import.meta.url);
fs.writeFileSync(new URL('W2_P1.openapi.json',folder),JSON.stringify(doc,null,2)+'\n');
const entries = Object.keys(paths).map(path => [path,`./W2_P1.openapi.json#/paths/${path.replace(/~/g,'~0').replace(/\//g,'~1')}`]);
// Minimal insertion preserves the existing W1 contract's formatting and content.
for (const filename of ['openapi.json','openapi.yaml']) {
  const file = new URL(filename,folder);
  let content = fs.readFileSync(file,'utf8');
  if (content.includes('W2_P1.openapi.json')) continue;
  if (filename.endsWith('.json')) content = content.replace('"paths": {','"paths": {\n'+entries.map(([p,r]) => `    ${JSON.stringify(p)}: { "$ref": ${JSON.stringify(r)} },`).join('\n'));
  else content = content.replace(/paths:\r?\n/,'paths:\n'+entries.map(([p,r]) => `  ${p}:\n    $ref: '${r}'\n`).join(''));
  fs.writeFileSync(file,content);
}
JSON.parse(fs.readFileSync(new URL('openapi.json',folder),'utf8'));
console.log(`W2-P1: ${Object.keys(paths).length} documented paths; root JSON parsed.`);
