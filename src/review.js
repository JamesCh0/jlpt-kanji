// Pure overlay operations. Original vocabulary files are never mutated.
export const reviewStatuses={pending:'미검수',approved:'승인',edited_approved:'수정 후 승인',excluded:'제외'};
export const reviewFields=['word','reading','meaning','category'];
const categories=['noun','verb','i_adjective','na_adjective','adverb','other'];
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=200&&!['__proto__','prototype','constructor'].includes(x);
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export function validateOverrides(rows){
 if(!Array.isArray(rows))throw Error('검수 결과는 배열이어야 합니다. 기존 기록은 변경하지 않았습니다.');
 const seen=new Set();return rows.map(r=>{
  if(!r||!validId(r.wordId)||seen.has(r.wordId)||!Object.hasOwn(reviewStatuses,r.reviewStatus)||!iso(r.updatedAt)||!(r.reviewedAt===null&&r.reviewStatus==='pending'||iso(r.reviewedAt)))throw Error('검수 상태 또는 검수 시각이 올바르지 않습니다.');
  seen.add(r.wordId);const override={};
  if(r.override===null||typeof r.override!=='object'||Array.isArray(r.override))throw Error('수정값 형식이 올바르지 않습니다.');
  for(const key of reviewFields)if(Object.hasOwn(r.override,key)){
   const v=r.override[key];if(typeof v!=='string'||!v.trim()||v.length>2000||key==='category'&&!categories.includes(v))throw Error('단어·읽기·뜻·품사 수정값을 확인해 주세요.');override[key]=v.trim();
  }
  if(r.reviewStatus==='edited_approved'&&reviewFields.some(k=>!override[k]))throw Error('수정 후 승인은 표기·읽기·뜻·품사 모두 필요합니다.');
  // Only edited approvals may change the vocabulary.
  return {wordId:r.wordId,reviewStatus:r.reviewStatus,override:r.reviewStatus==='edited_approved'?override:{},reviewedAt:r.reviewedAt,updatedAt:r.updatedAt};
 });
}
export function mergeOverrides(a=[],b=[]){
 const map=new Map(a.map(r=>[r.wordId,r]));for(const r of b){const old=map.get(r.wordId);if(!old||r.updatedAt>old.updatedAt||(r.updatedAt===old.updatedAt&&JSON.stringify(r)>JSON.stringify(old)))map.set(r.wordId,r)}
 return [...map.values()].sort((a,b)=>a.wordId.localeCompare(b.wordId));
}
export function applyOverrides(original,overrides=[]){
 const map=new Map(overrides.map(r=>[r.wordId,r]));return original.map(w=>{
  const r=map.get(w.id);if(!r)return w;
  const approved=['approved','edited_approved'].includes(r.reviewStatus);
  return {...w,...(r.reviewStatus==='edited_approved'?r.override:{}),needs_review:!approved,reviewStatus:r.reviewStatus};
 });
}
export function reviewExport(original,rows){const byId=new Map(original.map(w=>[w.id,w]));return {app:'kanji-flash',type:'review-overrides',schemaVersion:1,exportedAt:new Date().toISOString(),reviewOverrides:rows.map(r=>{const w=byId.get(r.wordId);return {...r,original:w?{id:w.id,level:w.level,levels:w.levels,word:w.word,reading:w.reading,meaning:w.meaning,category:w.category,needs_review:w.needs_review,review_reason:w.review_reason,sources:w.sources,sourceRefs:w.sourceRefs,core500:w.core500,darakwonDay:w.darakwonDay}:null}})}}
export function reviewCSV(original,rows){const byId=new Map(original.map(w=>[w.id,w]));const header=['id','level','original_word','final_word','original_reading','final_reading','original_meaning','final_meaning','original_category','final_category','review_status','review_reason','reviewed_at','updated_at','source_refs'];const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[header,...rows.map(r=>{const w=byId.get(r.wordId)||{},f=applyOverrides([{...w,id:r.wordId}],[r])[0];return [r.wordId,(w.levels||[w.level]).join(' / '),w.word,f.word,w.reading,f.reading,w.meaning,f.meaning,w.category,f.category,r.reviewStatus,w.review_reason,r.reviewedAt,r.updatedAt,JSON.stringify(w.sourceRefs||[])]})].map(row=>row.map(cell).join(',')).join('\r\n')}
