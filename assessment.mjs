// Cleanplate Lens is an explainable rules model, not a trained or validated food-safety predictor.
// Unknown evidence is never converted into a clean bill of health.
const DAY=86400000;
const normal=s=>String(s||'').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function daysOld(date,now=new Date()){if(!date)return null;const parsed=Date.parse(String(date).slice(0,10)+'T12:00:00Z');return Number.isFinite(parsed)?(now.getTime()-parsed)/DAY:null;}
export function textSignals(text){
 // Evaluate observed sentences, not generic code requirements, marketing, food opinions, or instructions.
 const sentences=String(text||'').split(/(?<=[.!?])\s+|\n+|\s+but\s+/i).map(s=>s.trim()).filter(Boolean);
 const negative=[],positive=[];
 for(const sentence of sentences){
  if(/\b(no|not|never|without|none|free of|didn't|did not)\b.{0,30}\b(rodent|rat|rats|mouse|mice|pest|cockroach|roach|dropping|dirty|mold|mould|contamination|infestation)/i.test(sentence))continue;
  if(/\b(must|shall|should|ensure|instruct|requirement|code requirement|prevent|avoid)\b/i.test(sentence)&&!(/\b(observed|saw|found|noticed|served|there (was|were)|i |we )\b/i.test(sentence)))continue;
  if(/\b(cockroaches?|roaches?|rodent droppings?|rat droppings?|mice|pest infestation|sewage|no running water|no hot water|dirty (?:utensils|cutlery|plates)|mou?ld(?:y)? food|cross[- ]contamination|served (?:raw|undercooked) (?:chicken|poultry))\b/i.test(sentence)&&/\b(observed|saw|found|noticed|served|there (was|were)|i |we )\b/i.test(sentence))negative.push(sentence);
  if(/\b(sign|poster|advertisement|marketing|website|claims? to)\b/i.test(sentence))continue;
  const negatedPractice=/\b(not|never|no|did not|didn't|without)\b.{0,30}\b(wash|washing|washed|saniti[sz]|clean)\b/i.test(sentence);
  if(negatedPractice&&/\b(i |we |observed|saw|watched|noticed)\b/i.test(sentence))negative.push(sentence);
  if(!negatedPractice&&/\b(i |we |observed|saw|watched|noticed)\b/i.test(sentence)&&/\b(wash(?:ed|ing)? (?:their |his |her )?hands|hands? (?:being )?wash(?:ed|ing)|saniti[sz](?:ed|ing) (?:the )?(?:utensils|surfaces|tables|equipment)|clean (?:utensils|cutlery)|separat(?:e|ed|ing) raw (?:and |from )?(?:cooked|ready.to.eat))\b/i.test(sentence))positive.push(sentence);
 }
 return {negative:[...new Set(negative)],positive:[...new Set(positive)]};
}
export function evaluateEvidence({restaurant,evidence=[],leads=[],checks=[],now=new Date()}){
 const usable=[],reasons=[],excluded=[];
 for(const e of evidence){const age=daysOld(e.date,now);if(age===null){excluded.push({reason:'An undated observation cannot support a current assessment.',source:e.source||'Observation'});continue;}if(age< -1){excluded.push({reason:'A future-dated item was ignored.',source:e.source||'Observation'});continue;}if(age>730){excluded.push({reason:'Evidence older than two years does not describe current conditions.',source:e.source||'Observation'});continue;}usable.push({...e,age});}
 const official=usable.filter(e=>e.kind==='official'&&e.branchVerified===true);
 const sorted=official.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const latest=sorted[0];
 const activeClosure=sorted.find(e=>e.outcome==='closed'&&e.age<=90&&!sorted.some(other=>other.outcome==='favorable'&&other.date>e.date));
 const officialConcern=sorted.find(e=>e.outcome==='concern'&&e.age<=180&&!sorted.some(other=>other.outcome==='favorable'&&other.date>e.date));
 const observations=usable.filter(e=>e.kind==='observation'&&e.age<=90);
 const negative=observations.filter(e=>e.signals?.negative?.length),positive=observations.filter(e=>e.signals?.positive?.length);
 let verdict='insufficient',label='Not enough evidence',tone='unknown',confidence='Insufficient',recommendation='Verify an inspection report before choosing on hygiene grounds.';
 if(activeClosure){verdict='avoid';label='Avoid for now';tone='concern';confidence='Official evidence';recommendation='The latest matched official evidence reports a recent closure. Confirm reopening with the authority before visiting.';reasons.push({title:'Recent official closure',detail:activeClosure.summary,source:activeClosure.source,url:activeClosure.url,date:activeClosure.date});}
 else if(officialConcern){verdict='caution';label='Use caution';tone='caution';confidence='Official evidence';recommendation='Check the listed findings and any newer follow-up inspection before deciding.';reasons.push({title:'Recent official concern',detail:officialConcern.summary,source:officialConcern.source,url:officialConcern.url,date:officialConcern.date});}
 else if(negative.length){verdict='caution';label='Concerns reported · unverified';tone='caution';confidence='Limited · user supplied';recommendation='Treat these as reports to verify, not proof that the restaurant is unclean. Check with the authority or ask for a recent report.';for(const e of negative)reasons.push({title:'Reported hygiene observation',detail:e.signals.negative.slice(0,2).join(' '),source:e.source,date:e.date,url:e.url,unverified:true});}
 else if(latest?.outcome==='favorable'&&latest.age<=365){verdict='lower_concern';label='Lower concern';tone='good';confidence='Official evidence';recommendation='The published outcome is reassuring for the inspection date. It does not establish current kitchen cleanliness.';reasons.push({title:'Favorable official inspection',detail:latest.summary,source:latest.source,url:latest.url,date:latest.date});}
 else if(positive.length){verdict='observations_only';label='Reassuring observations · unverified';tone='unknown';confidence='Limited · user supplied';recommendation='These observations are encouraging, but they cannot establish that the kitchen is clean. Verify an official report.';for(const e of positive)reasons.push({title:'Specific practice reportedly observed',detail:e.signals.positive.slice(0,2).join(' '),source:e.source,date:e.date,url:e.url,unverified:true});}
 if(!reasons.length)reasons.push({title:'No current, verified hygiene evidence',detail:'A directory listing, food rating, price, cuisine, nice photos, and the absence of complaints do not establish kitchen cleanliness.'});
 if(latest&&latest.age>365)reasons.push({title:'Inspection evidence is old',detail:'The latest linked inspection is more than a year old, so the model does not treat it as current reassurance.',source:latest.source,url:latest.url,date:latest.date});
 if(leads.length)reasons.push({title:'Possible news matches need verification',detail:`${leads.length} possible hygiene-related article(s) found. Their branch identity and claims have not been verified, so headlines do not determine the verdict.`});
 return {model:'Cleanplate Lens',version:'1.0',method:'Explainable evidence rules',experimental:true,verdict,label,tone,confidence,recommendation,reasons,excluded,evidenceCount:usable.length,officialEvidenceCount:official.length,leads,checks,assessedAt:now.toISOString(),officialStatusUnchanged:true,limitations:['This model is not a trained or validated food-safety predictor.','It cannot observe a kitchen or guarantee that food is safe.','A news headline is a lead, not a verified finding; user observations are unverified.','Text observations are evaluated in English; unsupported or ambiguous wording may be missed.']};
}
function officialOutcome(r){const label=normal(r.ratingLabel);if(/closure|failed closed/.test(label))return 'closed';if(r.ratingTone==='concern'||r.ratingTone==='caution')return 'concern';if(r.ratingTone==='good'&&r.sortRank!==null)return 'favorable';return 'unknown';}
export function observationEvidence(observations=[]){return observations.slice(0,5).filter(o=>o&&typeof o.text==='string').map(o=>({kind:'observation',source:'Your observation · not independently verified',date:String(o.date||'').slice(0,10),signals:textSignals(o.text.slice(0,3000)),summary:o.text.slice(0,3000),branchVerified:false}));}
let newsQueue=Promise.resolve(),lastNewsRequest=0;
export async function newsLeads(restaurant){
 const task=newsQueue.then(async()=>{
  await new Promise(r=>setTimeout(r,Math.max(0,5100-(Date.now()-lastNewsRequest))));lastNewsRequest=Date.now();
  const safe=s=>String(s||'').replace(/["()\\]/g,' ').slice(0,100);const q=`"${safe(restaurant.dba)}" "${safe(restaurant.boro)}" (hygiene OR inspection OR cockroach OR closure OR sanitation)`;
  const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');u.search=new URLSearchParams({query:q,mode:'artlist',format:'json',maxrecords:'8',timespan:'3months',sort:'datedesc'});
  const res=await fetch(u,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw new Error('The optional news index is unavailable. No conclusion was drawn from its absence.');
  let data;try{data=await res.json();}catch{throw new Error('The optional news index did not return usable records.');}
  return (data.articles||[]).filter(a=>/^https?:\/\//i.test(a.url||'')).slice(0,8).map(a=>({title:String(a.title||'').slice(0,240),url:a.url,publisher:a.domain||'News index',date:/^\d{8}/.test(a.seendate||'')?`${a.seendate.slice(0,4)}-${a.seendate.slice(4,6)}-${a.seendate.slice(6,8)}`:null,branchVerified:false,usedForVerdict:false}));
 });newsQueue=task.catch(()=>{});return task;
}
export async function assessRestaurant(restaurant,{observations=[],research=false}={}){
 const evidence=[],checks=[];let leads=[];
 if(restaurant.provider!=='osm'){
  const outcome=officialOutcome(restaurant);
  if(restaurant.inspection_date)evidence.push({kind:'official',branchVerified:true,date:restaurant.inspection_date,outcome,summary:`${restaurant.ratingLabel}. ${restaurant.score!==null?`${restaurant.score} ${restaurant.scoreUnit}. `:''}The authority's result is a snapshot for this date.`,source:restaurant.sourceName,url:restaurant.sourceUrl});
  checks.push({name:'Authority record from this search',status:restaurant.inspection_date?'checked':'missing',detail:restaurant.inspection_date?'Used the reported outcome and inspection date.':'The linked record does not provide a usable inspection date.'});
 }else checks.push({name:'Official inspection record',status:'missing',detail:'No official inspection is linked to this branch. Directory metadata is excluded from the verdict.'});
 if(research){try{leads=await newsLeads(restaurant);checks.push({name:'GDELT news index · recent coverage',status:'checked',detail:`${leads.length} potential matches. Headlines are excluded from the verdict until branch identity and claims can be verified.`});}catch(e){checks.push({name:'GDELT news index',status:'unavailable',detail:e.message});}}
 evidence.push(...observationEvidence(observations));
 return evaluateEvidence({restaurant,evidence,leads,checks});
}
