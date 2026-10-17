import http from 'node:http';
import {assessRestaurant,evaluateEvidence} from './assessment.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveLocations,resolveCoordinates,rememberedLocation,needsChoice,discoverNearby} from './locations.mjs';
import {providers,providerFor,metadata,inspectionDetails,socrata} from './providers.mjs';
export {area,latestRestaurants} from './providers.mjs';
export const query=params=>socrata('https://data.cityofnewyork.us/resource/43nn-pn8j.json',params);
const assessedPlaces=new Map();
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
export const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
  if(url.pathname==='/api/health')return json({app:'cleanplate',status:'ok',version:4});
  if(url.pathname==='/api/coverage')return json({providers:Object.values(metadata),globalDiscovery:true});
  if(url.pathname==='/api/restaurants'){
   const q=(url.searchParams.get('q')||'New York').trim().slice(0,150),country=(url.searchParams.get('country')||'').toLowerCase();
   if(country&&!/^[a-z]{2}$/.test(country))return json({error:'Please select a valid country.'},400);
   const radius=Number(url.searchParams.get('radius')||3);
   if(![1,3,5,10].includes(radius))return json({error:'Select a supported search radius.'},400);
   const hasCoordinates=url.searchParams.has('lat')&&url.searchParams.has('lon');
   const locations=hasCoordinates?await resolveCoordinates(Number(url.searchParams.get('lat')),Number(url.searchParams.get('lon'))):await resolveLocations(q,country);
   if(!locations.length)return json({error:'We couldn’t find that location. Add a country or try the nearest city.',notFound:true},404);
   const selected=url.searchParams.get('location');
   let location=selected?rememberedLocation(selected):locations[0];
   if(selected&&!locations.some(l=>l.id===selected))return json({error:'Please choose one of the matching locations.'},400);
   if(!selected&&needsChoice(q,locations))return json({resolutionRequired:true,locations,query:q});
   const provider=providerFor(location);let result,warning;
   if(provider){try{result=await providers[provider](location,q,radius);}catch(e){console.error('Inspection source unavailable:',provider,e.message);warning=`${metadata[provider].name} could not be reached. The places below are directory listings only; their inspections have not been verified.`;}}
   if(!result){
    let restaurants=[],directoryError;
    try{restaurants=await discoverNearby(location);}catch(e){directoryError=e.message;}
    result={restaurants,key:'osm',name:'OpenStreetMap restaurant directory',url:'https://www.openstreetmap.org/copyright',guidance:'These are real nearby directory listings. No official hygiene inspection has been linked, so none is ranked as clean or safe.',scale:'Inspection status unknown',cadence:'Directory records are fetched now, but individual map entries may be older.',directoryError};
    warning ||= `We found ${location.name}, ${location.country}. No official inspection feed is connected here yet. Nearby restaurants are shown with inspection status unknown.`;
   }
   const restaurants=result.restaurants.map(r=>r.provider==='osm'?{...r,assessment:evaluateEvidence({restaurant:r,checks:[{name:'Official inspection record',status:'missing',detail:'No official hygiene evidence is linked to this branch.'}]})}:r);
   for(const restaurant of restaurants)assessedPlaces.set(restaurant.camis,restaurant);
   while(assessedPlaces.size>5000)assessedPlaces.delete(assessedPlaces.keys().next().value);
   return json({restaurants,location,locations,query:q,radius,coverage:result.key==='osm'?'discovery':'official',warning,source:{key:result.key,name:result.name,url:result.url,guidance:result.guidance,scale:result.scale,cadence:result.cadence,publishedAt:result.publishedAt||null},directoryError:result.directoryError,nearbyAreas:result.nearbyAreas||[],fetchedAt:new Date().toISOString(),directoryRadiusKm:result.key==='osm'?1.2:null});
  }
  if(url.pathname==='/api/assessments'){
   if(req.method!=='POST')return json({error:'Use POST for an assessment.'},405);
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json({error:'Send JSON assessment input.'},415);
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>24000)return json({error:'The evidence is too long. Use up to five short observations.'},413);}
   let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid assessment input.'},400);}
   if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid assessment input.'},400);
   const restaurant=assessedPlaces.get(String(input.id||''));if(!restaurant)return json({error:'Search this location again to load a current place record before assessing it.'},404);
   if(input.observations!==undefined&&!Array.isArray(input.observations))return json({error:'Observations must be a list.'},400);
   const observations=input.observations||[];
   if(observations.length>5||observations.some(o=>!o||typeof o.text!=='string'||o.text.length>3000||!/^\d{4}-\d{2}-\d{2}$/.test(o.date||'')))return json({error:'Use up to five dated observations, each under 3,000 characters.'},400);
   return json(await assessRestaurant(restaurant,{observations,research:input.research===true}));
  }
  if(url.pathname.startsWith('/api/inspections/')){
   const parts=url.pathname.split('/').filter(Boolean);
   const provider=parts.length===3?'nyc':parts[2],id=parts.length===3?parts[2]:parts[3];
   return json(await inspectionDetails(provider,id));
  }
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','styles.css','app.js','motion.js','assessment.js','vendor/lottie_light.min.js','assets/preparing-food.json'].includes(file)){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html','Cache-Control':'no-cache'});res.end(await readFile(path.join(root,file)));
 }catch(e){console.error(e.message);return json({error:e.name==='TimeoutError'?'The public data service is taking too long. Please try again.':e.message==='fetch failed'?'The public data service could not be reached. Please try again.':e.message},502);}
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 server.on('error',e=>{console.error(e.code==='EPERM'?'This environment blocks localhost servers. Run npm start in a local terminal.':e.message);process.exitCode=1;});
 server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('Cleanplate is running at http://localhost:'+(process.env.PORT||3000)));
}
