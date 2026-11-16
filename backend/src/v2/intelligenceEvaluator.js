import { z } from 'zod';

const field = z.string().regex(/^(title|issuer|level_code|achievement_type_id|achieved_at|attributes\.[A-Za-z0-9_]+)$/);
const filter = z.object({ field, operator: z.enum(['eq','ne','in','gte','lte','contains']), value: z.union([z.string(),z.number(),z.boolean(),z.array(z.union([z.string(),z.number(),z.boolean()])).max(100)]) }).strict();
export const ruleSchema = z.lazy(() => z.union([
  z.object({ operator: z.enum(['AND','OR']), rules: z.array(ruleSchema).min(1).max(30) }).strict(),
  z.object({ type: z.enum(['count','sum','boolean','distinct_years']), filters: z.array(filter).max(30).default([]), field: field.optional(), target: z.number().finite().nonnegative().max(1e12), comparator: z.enum(['gte','lte','eq']).default('gte'), from: z.string().date().optional(), to: z.string().date().optional(), last_years: z.number().int().min(1).max(100).optional(), measure_unit: z.string().max(80).default('thành tích') }).strict().superRefine((r,c)=>{if(r.type==='sum'&&!r.field)c.addIssue({code:'custom',message:'sum requires field'});if(r.from&&r.to&&r.from>r.to)c.addIssue({code:'custom',message:'Invalid date window'});})
]));
export const applicabilitySchema = z.object({ person_types:z.array(z.enum(['STUDENT','LECTURER','STAFF','OTHER'])).min(1).optional() }).strict();
export const aggregationSchema = z.object({operator:z.enum(['AND','OR']).default('AND')}).strict();
const get = (a,f) => f.startsWith('attributes.') ? a.attributes?.[f.slice(11)] : a[f];
export function combine(states, operator='AND') {
  const s=states.filter(x=>x!=='NOT_APPLICABLE');
  if(!s.length)return 'INSUFFICIENT_DATA';
  if(operator==='OR')return s.includes('MET')?'MET':s.includes('INSUFFICIENT_DATA')?'INSUFFICIENT_DATA':'NOT_MET';
  return s.includes('NOT_MET')?'NOT_MET':s.includes('INSUFFICIENT_DATA')?'INSUFFICIENT_DATA':'MET';
}
export function evaluateRule(raw, achievements, evaluationDate, depth=0) {
  if(depth>12)throw new Error('Rule nesting exceeds limit');
  const r=raw;
  if(r.rules){const children=r.rules.map(x=>evaluateRule(x,achievements,evaluationDate,depth+1));return {conclusion:combine(children.map(x=>x.conclusion),r.operator),actual_value:null,target_value:null,measure_unit:null,missing:{children},matches:[...new Set(children.flatMap(x=>x.matches))]};}
  let unknown=false;
  let from=r.from;
  if(r.last_years){const d=new Date(`${evaluationDate}T00:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()-r.last_years);from=[from,d.toISOString().slice(0,10)].filter(Boolean).sort().at(-1);}
  const to=r.to&&r.to<evaluationDate?r.to:evaluationDate;
  const matches=achievements.filter(a=>{
    const day=String(a.achieved_at).slice(0,10);if(day>to||(from&&day<from))return false;
    let missing=false;
    for(const f of r.filters||[]){const v=get(a,f.field);if(v===undefined||v===null){missing=true;continue;}
      const yes=f.operator==='eq'?v===f.value:f.operator==='ne'?v!==f.value:f.operator==='in'?Array.isArray(f.value)&&f.value.includes(v):f.operator==='contains'?typeof v==='string'&&typeof f.value==='string'&&v.toLocaleLowerCase().includes(f.value.toLocaleLowerCase()):f.operator==='gte'?typeof v==='number'&&typeof f.value==='number'&&v>=f.value:typeof v==='number'&&typeof f.value==='number'&&v<=f.value;
      if(!yes)return false;
    }
    if(missing){unknown=true;return false;}return true;
  });
  let actual=matches.length;
  if(r.type==='boolean')actual=matches.length?1:0;
  if(r.type==='distinct_years')actual=new Set(matches.map(x=>String(x.achieved_at).slice(0,4))).size;
  if(r.type==='sum')actual=matches.reduce((n,a)=>{const v=get(a,r.field);if(typeof v!=='number'||!Number.isFinite(v)){unknown=true;return n;}return n+v;},0);
  const met=r.comparator==='lte'?actual<=r.target:r.comparator==='eq'?actual===r.target:actual>=r.target;
  // Unknown attributes can change an equality/upper-bound result, or fill a lower-bound gap.
  const uncertain=unknown&&(r.type==='sum'||r.comparator!=='gte'||!met);
  return {conclusion:uncertain?'INSUFFICIENT_DATA':met?'MET':'NOT_MET',actual_value:actual,target_value:r.target,measure_unit:r.measure_unit,missing:{remaining:r.comparator==='gte'?Math.max(0,r.target-actual):null,unknown_attributes:unknown,comparator:r.comparator},matches:matches.map(x=>x.id)};
}
export function evaluateVersion(version, groups, criteria, profile, achievements, evaluationDate) {
  const applicability=applicabilitySchema.parse(typeof version.applicability_json==='string'?JSON.parse(version.applicability_json):version.applicability_json);
  const applicable=!applicability.person_types||applicability.person_types.includes(profile?.person_type);
  const unknownApplicability=Boolean(applicability.person_types&&!profile?.person_type);
  const results=criteria.map(c=>{
    const rule=ruleSchema.parse(typeof c.rule_json==='string'?JSON.parse(c.rule_json):c.rule_json);
    const value=c.coverage_status&&c.coverage_status!=='AUTOMATED'?{conclusion:'INSUFFICIENT_DATA',actual_value:null,target_value:null,measure_unit:null,missing:{manual_review_required:true,coverage_status:c.coverage_status},matches:[]}:evaluateRule(rule,achievements,evaluationDate);
    // Exclusion: matching the prohibited condition means this criterion is unmet.
    if(c.is_exclusion&&value.conclusion!=='INSUFFICIENT_DATA')value.conclusion=value.conclusion==='MET'?'NOT_MET':'MET';
    if(!applicable)value.conclusion=unknownApplicability?'INSUFFICIENT_DATA':'NOT_APPLICABLE';
    return {...value,criterion_id:c.id,criterion:c};
  });
  const required=results.filter(r=>r.criterion.is_required&&!r.criterion.is_exclusion);
  const states=required.filter(r=>!r.criterion.criterion_group_id).map(r=>r.conclusion);
  for(const g of groups){const selected=required.filter(r=>Number(r.criterion.criterion_group_id)===Number(g.id));if(g.is_required&&selected.length)states.push(combine(selected.map(r=>r.conclusion),g.operator));}
  const agg=aggregationSchema.parse(typeof version.aggregation_json==='string'?JSON.parse(version.aggregation_json):version.aggregation_json);
  const exclusions=results.filter(r=>r.criterion.is_exclusion).map(r=>r.conclusion);
  let conclusion=!applicable?(unknownApplicability?'INSUFFICIENT_DATA':'NOT_APPLICABLE'):combine(states,agg.operator);
  if(applicable){if(exclusions.includes('NOT_MET'))conclusion='NOT_MET';else if(exclusions.includes('INSUFFICIENT_DATA')&&conclusion==='MET')conclusion='INSUFFICIENT_DATA';}
  return {results,conclusion,completion_percent:results.length?Math.round(results.filter(r=>r.conclusion==='MET').length/results.length*10000)/100:0};
}
