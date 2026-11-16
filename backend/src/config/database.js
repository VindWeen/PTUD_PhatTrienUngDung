import sql from 'mssql';
import { EventEmitter } from 'node:events';
import config from './env.js';

// Native T-SQL only. This adapter binds parameter markers; it never rewrites SQL syntax.
export function bindParameters(text, values = []) {
  let result = '', state = 'normal';
  for (let i = 0; i < text.length;) {
    const c = text[i], n = text[i + 1];
    if (state === 'normal') {
      if (c === "'") state = 'string';
      else if (c === '"') state = 'quoted';
      else if (c === '[') state = 'bracket';
      else if (c === '-' && n === '-') state = 'line';
      else if (c === '/' && n === '*') state = 'comment';
      else if (c === '$' && /[1-9]/.test(n || '')) {
        const match = text.slice(i).match(/^\$(\d+)/)[0];
        if (Number(match.slice(1)) > values.length) throw new Error('Missing SQL parameter');
        result += '@p' + match.slice(1); i += match.length; continue;
      }
    } else if (state === 'string' && c === "'") {
      if (n === "'") { result += "''"; i += 2; continue; } state = 'normal';
    } else if (state === 'quoted' && c === '"') {
      if (n === '"') { result += '""'; i += 2; continue; } state = 'normal';
    } else if (state === 'bracket' && c === ']') {
      if (n === ']') { result += ']]'; i += 2; continue; } state = 'normal';
    } else if (state === 'line' && c === '\n') state = 'normal';
    else if (state === 'comment' && c === '*' && n === '/') { result += '*/'; i += 2; state = 'normal'; continue; }
    result += c; i++;
  }
  return result;
}
const jsonFields = new Set([
  'snapshot','snapshot_data','snapshotData','input_snapshot','inputSnapshot',
  'achievement_ids','award_record_ids','retrieved_chunk_ids','embedding_vector',
  'achievement_sources','source_rules','sourceRules','metadata','details','payload',
  'provider_evidence','retrieval_metadata','citations','summary','items','result',
  'active_versions','files','legal_references','rule_config','config','criteria_snapshot',
  'evaluation_result','response_data','request_data','explanation','draft','published',
  'published_draft','old_values','new_values','oldValues','newValues',
]);
function normalizeRow(row, columns = {}) {
  const out = {};
  for (const [key,value] of Object.entries(row)) {
    if (columns[key]?.type === sql.BigInt && typeof value==='string' && /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) out[key]=Number(value);
    else if (value instanceof Date && columns[key]?.type === sql.Date) out[key] = value.toISOString().slice(0,10);
    else if (typeof value === 'string' && jsonFields.has(key) && /^[\s]*[\[{]/.test(value)) {
      try { out[key] = JSON.parse(value); } catch { out[key] = value; }
    } else out[key] = value;
  }
  return out;
}
function normalizeError(error) {
  error.sqlServerNumber = error.number;
  const codes = {2601:'23505',2627:'23505',547:'23514',515:'23502',1205:'40001',51001:'40001',51003:'40001',51005:'23P01'};
  if (codes[error.number]) error.code = codes[error.number];
  else if (error.number >= 51000 && error.number <= 51999) error.code = '23514';
  return error;
}
async function execute(owner,text,values=[]) {
  const request = new sql.Request(owner);
  for (let i=0;i<values.length;i++) {
    let v=values[i]??null,type;
    if (Array.isArray(v)||(v&&typeof v==='object'&&!(v instanceof Date)&&!Buffer.isBuffer(v))) v=JSON.stringify(v);
    if (typeof v==='boolean') type=sql.Bit;
    else if(typeof v==='bigint'||(typeof v==='number'&&Number.isSafeInteger(v))) type=sql.BigInt;
    else if(typeof v==='number') type=sql.Float;
    else if(v instanceof Date) type=sql.DateTime2;
    else if(Buffer.isBuffer(v)) type=sql.VarBinary(sql.MAX);
    else type=sql.NVarChar(sql.MAX);
    request.input(`p${i+1}`,type,typeof v==='bigint'?v.toString():v);
  }
  try {
    const result=await request.query(bindParameters(text,values));
    const sets=result.recordsets||[];
    const recordset=sets.length?sets[sets.length-1]:result.recordset||[];
    const rows=recordset.map(row=>normalizeRow(row,recordset.columns));
    return {rows,rowCount:sets.length?rows.length:(result.rowsAffected||[]).reduce((a,b)=>a+b,0),recordset:rows,rowsAffected:result.rowsAffected||[]};
  } catch(error) {throw normalizeError(error);}
}
class Client {
  constructor(pool){this.pool=pool;this.transaction=null;this.released=false;this.pending=Promise.resolve();}
  query(text,values=[]) {
    // mssql allows only one active request per transaction connection.
    const work=this.pending.then(()=>this.execute(text,values));this.pending=work.catch(()=>{});return work;
  }
  async execute(text,values=[]) {
    if(this.released) throw new Error('SQL client already released');
    const cmd=text.trim().replace(/;$/,'').toUpperCase();
    if(cmd==='BEGIN'||cmd==='BEGIN TRANSACTION') {
      if(this.transaction)throw new Error('Nested transactions are not supported');
      const tx=new sql.Transaction(this.pool.native);
      tx.on('rollback',()=>{if(this.transaction===tx)this.transaction=null;});
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);this.transaction=tx;
      return {rows:[],rowCount:0};
    }
    if(cmd==='COMMIT'||cmd==='ROLLBACK') {
      const tx=this.transaction;
      if(!tx){if(cmd==='ROLLBACK')return {rows:[],rowCount:0};throw new Error('No active transaction');}
      try{await(cmd==='COMMIT'?tx.commit():tx.rollback());}finally{this.transaction=null;}
      return {rows:[],rowCount:0};
    }
    return execute(this.transaction||this.pool.native,text,values);
  }
  async release(){await this.pending;if(this.transaction){try{await this.transaction.rollback();}finally{this.transaction=null;}}this.released=true;}
}
export class Pool extends EventEmitter {
  constructor(options=getDbPoolConfig()){super();this.native=new sql.ConnectionPool(options);this.connecting=null;this.native.on('error',e=>this.emit('error',e));this.on('error',()=>{});}
  async ready(){if(!this.connecting)this.connecting=this.native.connect().catch(e=>{this.connecting=null;throw e;});await this.connecting;return this;}
  async connect(){await this.ready();return new Client(this);}
  async query(text,values=[]){await this.ready();return execute(this.native,text,values);}
  async end(){await this.native.close();this.connecting=null;}
}
export function getDbPoolConfig(){return {
  server:config.DB_HOST,port:config.DB_PORT,database:config.DB_NAME,user:config.DB_USER,password:config.DB_PASSWORD,
  pool:{min:config.DB_POOL_MIN,max:config.DB_POOL_MAX,idleTimeoutMillis:30000},
  connectionTimeout:config.DB_CONNECTION_TIMEOUT,requestTimeout:config.DB_REQUEST_TIMEOUT,
  options:{encrypt:config.DB_ENCRYPT,trustServerCertificate:config.DB_TRUST_SERVER_CERTIFICATE,useUTC:true,abortTransactionOnError:true,appName:'LHU-PTUD'},
};}
let pool=null;
export async function connectDB(){
  if(pool&&typeof pool.ready!=='function')return pool; // Explicit setPool test/integration dependency.
  if(!pool)pool=new Pool();const current=pool;
  try{await current.ready();return current;}catch(e){await current.end().catch(()=>{});if(pool===current)pool=null;throw e;}
}
export function getPool(){if(!pool)throw new Error('SQL Server chưa kết nối; gọi connectDB() trước');return pool;}
export async function query(text, values = []) { return (await connectDB()).query(text, values); }
export function setPool(value){pool=value;}
export async function closeDB(){const p=pool;pool=null;if(p)await p.end();}
export async function checkHealth(){const start=Date.now();try{const p=await connectDB();const r=await p.query('SELECT 1 AS is_alive,SYSUTCDATETIME() AS server_time');return {status:'UP',isConnected:true,databaseEngine:'SQL Server',latencyMs:Date.now()-start,serverTime:r.rows[0].server_time};}catch(e){return {status:'DOWN',isConnected:false,latencyMs:Date.now()-start,error:e.message};}}
export {sql};
export default {connectDB,getPool,setPool,closeDB,checkHealth,getDbPoolConfig,Pool,sql};
