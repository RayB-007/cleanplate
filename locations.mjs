const agent='Cleanplate/2.0 (interactive local restaurant inspection explorer)';
const cache=new Map(), known=new Map();
let geocodeQueue=Promise.resolve(), lastRequest=0;
export const distance=(a,b)=>{const rad=Math.PI/180;const dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2));};
export function locationFromOSM(r){const a=r.address||{};return {id:`${r.osm_type||'place'}:${r.osm_id||r.place_id}`,lat:Number(r.lat),lon:Number(r.lon),label:r.display_name,name:r.name||a.city||a.town||a.village||a.postcode,kind:r.addresstype||r.type||'place',countryCode:a.country_code||'',country:a.country||'',city:a.city||a.town||a.village||a.municipality||'',state:a.state||'',county:a.county||'',postcode:r.type==='postcode'||r.addresstype==='postcode'?a.postcode||r.name||'':a.postcode||'',isPostcode:r.type==='postcode'||r.addresstype==='postcode',bounds:r.boundingbox?.map(Number)};}
export async function resolveLocations(q,country=''){
 if(!q.trim())return [];
 const key=q.toLowerCase()+'|'+country;const hit=cache.get(key);if(hit&&Date.now()-hit.time<86400000)return hit.locations;
 // Nominatim permits at most one request per second. Search is submitted explicitly, never autocomplete.
 const task=geocodeQueue.then(async()=>{
  await new Promise(r=>setTimeout(r,Math.max(0,1100-(Date.now()-lastRequest))));lastRequest=Date.now();
  const url=new URL(process.env.GEOCODER_URL||'https://nominatim.openstreetmap.org/search');
  url.search=new URLSearchParams({q,format:'jsonv2',addressdetails:'1',limit:'5','accept-language':'en',...(country?{countrycodes:country}:{})});
  const res=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw new Error('The location service is temporarily unavailable. Please try again.');
  const locations=(await res.json()).map(locationFromOSM).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
  for(const location of locations)known.set(location.id,location);
  if(cache.size>500)cache.delete(cache.keys().next().value);
  cache.set(key,{time:Date.now(),locations});return locations;
 });geocodeQueue=task.catch(()=>{});return task;
}
export function rememberedLocation(id){return known.get(id);}
export function needsChoice(q,locations){return /^\d[\d\s-]{1,10}$/.test(q.trim())&&locations.length>1&&locations.some(l=>distance(l,locations[0])>30);}
export async function discoverNearby(location){
 const lat=location.lat,lon=location.lon;
 // Small map extracts avoid depending on Overpass availability. OSM is a directory, never an inspection source.
 for(const halfKm of [1.2,0.6]){
  const dy=halfKm/111.32,dx=halfKm/(111.32*Math.max(.1,Math.cos(lat*Math.PI/180)));
  const bounds=[Math.max(-180,lon-dx),Math.max(-90,lat-dy),Math.min(180,lon+dx),Math.min(90,lat+dy)];
  const url=`https://www.openstreetmap.org/api/0.6/map.json?bbox=${bounds.join(',')}`;
  const res=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(30000)});
  if(res.status===400&&halfKm===1.2)continue;
  if(!res.ok)throw new Error('The worldwide restaurant directory is temporarily unavailable. Please try again.');
  const data=await res.json(),nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
  const result=[];
  for(const e of data.elements){
   const t=e.tags||{};if(!['restaurant','cafe','fast_food','food_court'].includes(t.amenity)||!t.name)continue;
   let coords=e;
   if(e.type==='way'){const points=(e.nodes||[]).map(id=>nodes.get(id)).filter(Boolean);if(!points.length)continue;coords={lat:points.reduce((s,p)=>s+p.lat,0)/points.length,lon:points.reduce((s,p)=>s+p.lon,0)/points.length};}
   if(!Number.isFinite(coords.lat)||!Number.isFinite(coords.lon))continue;
   const km=distance(location,coords);if(km>halfKm*1.5)continue;
   result.push({camis:`osm-${e.type}-${e.id}`,provider:'osm',dba:t.name,boro:location.city||location.name,building:t['addr:housenumber']||'',street:t['addr:street']||'',address:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' ')||'Street address not listed',zipcode:t['addr:postcode']||'',cuisine_description:(t.cuisine||t.amenity).replaceAll(';',', ').replaceAll('_',' '),inspection_date:null,score:null,sortRank:null,ratingLabel:'Inspection unknown',scoreDisplay:'—',scoreUnit:'not verified',ratingTone:'unknown',sourceName:'OpenStreetMap directory',sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,latitude:coords.lat,longitude:coords.lon,distanceKm:km,website:/^https?:\/\//i.test(t.website||'')?t.website:null});
  }
  return result.sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,120);
 }
 return [];
}

export async function resolveCoordinates(lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)throw new Error('Invalid location coordinates.');
 const key=`coordinates:${lat.toFixed(4)},${lon.toFixed(4)}`;const hit=cache.get(key);if(hit&&Date.now()-hit.time<3600000)return hit.locations;
 const task=geocodeQueue.then(async()=>{
  await new Promise(r=>setTimeout(r,Math.max(0,1100-(Date.now()-lastRequest))));lastRequest=Date.now();
  const url=new URL('https://nominatim.openstreetmap.org/reverse');url.search=new URLSearchParams({lat:String(lat),lon:String(lon),format:'jsonv2',addressdetails:'1','accept-language':'en'});
  const res=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error('The location service is temporarily unavailable. Enter your ZIP code instead.');
  const data=await res.json();if(data.error)throw new Error('No address was found here. Try the nearest town.');const location={...locationFromOSM(data),id:key,lat,lon,isPostcode:false,label:`Near ${data.address?.city||data.address?.town||data.address?.village||data.display_name}`};known.set(key,location);cache.set(key,{time:Date.now(),locations:[location]});return [location];
 });geocodeQueue=task.catch(()=>{});return task;
}
