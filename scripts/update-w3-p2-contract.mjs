// W3-P2 standalone contract, leaves teammates' consolidated contracts untouched.
import fs from 'node:fs';
const text=max=>({type:'string',minLength:1,maxLength:max});
const id={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
const amount={oneOf:[{type:'number',minimum:0,maximum:1e12},{type:'string',pattern:'^\\d+(\\.\\d+)?$'}]};
const date={type:'string',format:'date',description:'Ngày thật, 1990–2100; periodEnd >= periodStart'};
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const fields={code:text(80),title:{...text(255),minLength:5},measureUnit:text(80),periodStart:date,periodEnd:date,target:amount,plan:{type:'string',maxLength:4000,default:''},sourceNote:text(2000)};
const required=Object.keys(fields).filter(k=>k!=='plan');
const schemas={
  GoalInput:object({...fields,subjectType:{type:'string',enum:['LECTURER','UNIT'],default:'LECTURER'},organizationUnitId:id},required),
  GoalUpdate:object({...fields,version:id},[...required,'version']),
  ResultInput:object({actual:amount,sourceNote:text(2000),evidenceNote:text(4000)}),
  Version:object({version:id}),Draft:object({version:id,achievementTypeId:id}),Import:object({csv:{type:'string',minLength:1,maxLength:500000}}),
};
schemas.ResultUpdate=object({...schemas.ResultInput.properties,version:id});
const decimal={type:'string',description:'pg BIGINT/NUMERIC trả chuỗi'};
schemas.Result={type:'object',properties:{result_id:decimal,goal_id:decimal,actual:decimal,source:{type:'string',enum:['MANUAL','CSV']},source_note:{type:'string'},evidence_note:{type:'string'},achievement_id:{...decimal,nullable:true},created_by:decimal,version:decimal,created_at:{type:'string',format:'date-time'},updated_at:{type:'string',format:'date-time'}}};
schemas.Goal={type:'object',properties:{goal_id:decimal,lecturer_id:{...decimal,nullable:true},unit_id:{...decimal,nullable:true},context_unit_id:decimal,code:{type:'string'},title:{type:'string'},measure_unit:{type:'string'},period_start:{type:'string',format:'date-time'},period_end:{type:'string',format:'date-time'},target:decimal,plan:{type:'string'},source:{type:'string',enum:['MANUAL','CSV']},source_note:{type:'string'},status:{type:'string',enum:['DRAFT','ACCEPTED']},accepted_by:{...decimal,nullable:true},accepted_at:{type:'string',format:'date-time',nullable:true},created_by:decimal,version:decimal,created_at:{type:'string',format:'date-time'},updated_at:{type:'string',format:'date-time'},result:{allOf:[{$ref:'#/components/schemas/Result'}],nullable:true}}};
const paths={};
schemas.Goal.properties.period_start={type:'string',format:'date'};
schemas.Goal.properties.period_end={type:'string',format:'date'};
function operation(path,method,summary,input,response='Goal',status='200') {
  paths[path] ||= {};
  const schema=typeof response==='string'?{$ref:`#/components/schemas/${response}`}:response;
  paths[path][method]={summary,tags:['W3-P2 KPI'],security:[{bearerAuth:[]}],responses:{[status]:{description:'Thành công',content:{'application/json':{schema:{type:'object',properties:{success:{type:'boolean',enum:[true]},data:schema}}}}},400:{description:'Payload/CSV/danh mục không hợp lệ'},401:{description:'Chưa đăng nhập hoặc tài khoản không ACTIVE'},403:{description:'Không phải chính chủ/đại diện hợp lệ'},404:{description:'Không tìm thấy'},409:{description:'Version/trùng kỳ/trạng thái hoặc kết quả đã liên kết'}}};
  if(path.includes('{id}')) paths[path][method].parameters=[{name:'id',in:'path',required:true,schema:id}];
  if(input) paths[path][method].requestBody={required:true,content:{'application/json':{schema:{$ref:`#/components/schemas/${input}`}}}};
}
operation('/kpi/goals','get','Danh sách KPI thuộc chủ thể hiện hành',null,{type:'object',properties:{items:{type:'array',items:{$ref:'#/components/schemas/Goal'}}}});
paths['/kpi/goals'].get.parameters=[{name:'subjectType',in:'query',schema:{type:'string',enum:['LECTURER','UNIT'],default:'LECTURER'}},{name:'organizationUnitId',in:'query',description:'Bắt buộc khi UNIT; không nhận khi LECTURER',schema:id}];
operation('/kpi/goals','post','Tạo mục tiêu DRAFT/MANUAL','GoalInput','Goal','201');
operation('/kpi/goals/{id}','patch','Sửa DRAFT, không sửa chủ thể','GoalUpdate');
operation('/kpi/goals/{id}','delete','Xóa DRAFT','Version');
operation('/kpi/goals/{id}/accept','post','Người dùng chấp nhận mục tiêu, không xác nhận kết quả','Version');
operation('/kpi/goals/{id}/result','post','Ghi kết quả MANUAL, cần ACCEPTED','ResultInput','Result','201');
operation('/kpi/goals/{id}/result','patch','Sửa kết quả chưa tạo kê khai','ResultUpdate','Result');
operation('/kpi/goals/{id}/result','delete','Xóa kết quả chưa tạo kê khai','Version','Result');
operation('/kpi/goals/{id}/result/draft','post','Hành động chủ động tạo DRAFT, không VERIFIED/khen thưởng','Draft','Result','201');
for(const action of ['preview','commit']) operation(`/kpi/import/${action}`,'post',action==='preview'?'Kiểm tra CSV, không ghi':'Kiểm tra lại và import CSV atomic; bỏ trùng','Import',{type:'object',properties:{imported:{type:'integer'},duplicates:{type:'integer'},rows:{type:'array',items:{type:'object',properties:{row:{type:'integer'},status:{type:'string',enum:['READY_GOAL','READY_RESULT','DUPLICATE','INVALID','IMPORTED']},message:{type:'string'},error:{},goalId:decimal,goal:{type:'object'},result:{type:'object',nullable:true}}}}}});
operation('/kpi/catalogs','get','Danh mục active và đơn vị có phân công đại diện',null,{type:'object',properties:{types:{type:'array',items:{type:'object'}},units:{type:'array',items:{type:'object'}}}});
operation('/kpi/template.csv','get','Template CSV UTF-8 BOM, có nhãn MO PHONG',null,{type:'string'});
paths['/kpi/template.csv'].get.responses['200'].content={'text/csv':{schema:{type:'string'}}};
const doc={openapi:'3.0.3',info:{title:'W3-P2 Internal KPI',version:'1.0.0',description:'Hợp đồng bổ sung; xem KPI_W3_P2.md cho quyền, CSV và workflow. GoalInput UNIT cần organizationUnitId. Date/amount được kiểm thêm bằng Zod/backend. Không có AI hay KPI ngoài.'},servers:[{url:'/api/v1'}],paths,components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},schemas}};
fs.writeFileSync(new URL('../docs/api/W3_P2.openapi.json',import.meta.url),JSON.stringify(doc,null,2)+'\n');
console.log('W3-P2 OpenAPI generated: 9 paths, 13 operations');
