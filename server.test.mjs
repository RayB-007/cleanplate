import test from 'node:test';
import assert from 'node:assert/strict';
import {area,latestRestaurants} from './server.mjs';
const record=(overrides={})=>({camis:'50000001',dba:'Test restaurant',inspection_date:'2026-01-01',score:'7',action:'Violations were cited',...overrides});
test('NYC search handles boroughs, ZIP codes and unsupported locations',()=>{
 assert.equal(area('  Brooklyn  '),"boro='Brooklyn'");assert.equal(area('10012'),"zipcode='10012'");assert.ok(area('New York'));assert.equal(area('Los Angeles'),null);assert.equal(area("10012' OR 1=1"),null);
});
test('duplicate violation rows yield one restaurant and latest inspection wins',()=>{
 const result=latestRestaurants([record(),record(),record({inspection_date:'2026-04-01',score:'18'})]);assert.equal(result.length,1);assert.equal(result[0].score,18);
});
test('a newer unscored inspection or closure cannot expose an old clean score',()=>{
 assert.equal(latestRestaurants([record(),record({inspection_date:'2026-04-01',score:undefined})]).length,0);
 assert.equal(latestRestaurants([record(),record({inspection_date:'2026-04-01',action:'Establishment Closed by DOHMH.'})]).length,0);
});
test('same-day ambiguity favors the higher score and closure',()=>{
 assert.equal(latestRestaurants([record({score:'19'}),record()])[0].score,19);
 assert.equal(latestRestaurants([record(),record({action:'Establishment Closed by DOHMH.'}),record({score:'22'}),record({grade:'A'})]).length,0);
});
test('reported grade is retained without inventing a score-based grade',()=>{
 assert.equal(latestRestaurants([record(),record({grade:'A'})])[0].grade,'A');assert.equal(latestRestaurants([record()])[0].grade,undefined);
});

import {providerFor,normalizeUK,normalizeFrance,normalizeChicago,normalizeSF} from './providers.mjs';
import {needsChoice,locationFromOSM,distance} from './locations.mjs';
test('worldwide resolver keeps country and postcode distinct',()=>{
 const l=locationFromOSM({osm_type:'relation',osm_id:7,lat:'48.86',lon:'2.34',type:'postcode',name:'75001',display_name:'75001, Paris, France',address:{postcode:'75001',city:'Paris',country_code:'fr',country:'France'}});
 assert.equal(l.countryCode,'fr');assert.equal(l.postcode,'75001');assert.equal(l.isPostcode,true);assert.equal(providerFor(l),'fr');
});
test('provider routing never treats arbitrary world postcodes as NYC',()=>{
 assert.equal(providerFor({countryCode:'gb',lat:51.5,lon:0}),'uk');assert.equal(providerFor({countryCode:'us',lat:41.88,lon:-87.63}),'chicago');assert.equal(providerFor({countryCode:'us',lat:37.78,lon:-122.42}),'sf');assert.equal(providerFor({countryCode:'in',lat:19.07,lon:72.88}),null);assert.equal(providerFor({countryCode:'us',lat:34.05,lon:-118.24}),null);
});
test('ambiguous numeric postcodes require choosing a location',()=>{
 const places=[{lat:50.85,lon:4.35},{lat:14.59,lon:120.98}];assert.equal(needsChoice('1000',places),true);assert.equal(needsChoice('London',places),false);assert.equal(needsChoice('1000',[places[0]]),false);assert.ok(distance(places[0],places[1])>10000);
});
test('UK official hygiene scores sort higher values first without customer stars',()=>{
 const good=normalizeUK({FHRSID:1,BusinessName:'A',RatingValue:'5',RatingDate:'2026-01-01',scores:{Hygiene:0}},{});
 const poor=normalizeUK({FHRSID:2,BusinessName:'B',RatingValue:'1'},{});
 assert.ok(good.sortRank<poor.sortRank);assert.equal(good.scoreUnit,'out of 5');assert.equal(good.findings[0].text,'Hygiene: 0 compliance points (lower is better).');
 const ungraded=normalizeUK({FHRSID:3,RatingValue:'AwaitingInspection'},{});assert.equal(ungraded.score,null);assert.equal(ungraded.sortRank,null);
});
test('Scottish outcomes retain native labels and no invented numeric score',()=>{
 const pass=normalizeUK({FHRSID:1,RatingValue:'Pass'},{});assert.equal(pass.ratingLabel,'Pass');assert.equal(pass.score,null);assert.equal(pass.sortRank,0);
});
test('France, Chicago and SF keep outcome text rather than inventing a numeric score',()=>{
 const france=normalizeFrance({code_ua:'1',enseigne:'A',synthese_eval_sanit:'Très satisfaisant'},{});assert.equal(france.sortRank,0);assert.equal(france.score,null);
 const chicago=normalizeChicago({license_:'1',dba_name:'B',results:'Pass'},{});assert.equal(chicago.scoreDisplay,'Pass');assert.equal(chicago.score,null);assert.equal(chicago.boro,'Chicago');
 const sf=normalizeSF({permit_number:'1',dba:'C',facility_rating_status:'Conditional Pass'},{});assert.equal(sf.sortRank,1);assert.equal(sf.score,null);
});

import {normalizeSanMateo,isInstitutional} from './san-mateo.mjs';
test('94027 resolves to its county provider instead of an unverified map fallback',()=>{
 const l=locationFromOSM({place_id:1,lat:'37.453525',lon:'-122.2031556',type:'postcode',name:'94027',address:{postcode:'94027',town:'Atherton',county:'San Mateo County',state:'California',country_code:'us'}});
 assert.equal(l.county,'San Mateo County');assert.equal(l.city,'Atherton');assert.equal(providerFor(l),'sanmateo');
});
test('county records use latest inspection, preserve native status, and never invent scores',()=>{
 const r={recordId:'0f08y0000000rDrAAI',facilityName:'Example Cafe',facilityAddress:'80 EXAMPLE LN, ATHERTON, CA 94027',visitResult:'Pass'};
 const n=normalizeSanMateo(r,[{visitEndDateTime:'2025-01-01',visitResult:'Pass'},{visitEndDateTime:'2026-04-27',visitResult:'Conditional Pass',visitOpenViolations:'2'}],{city:'Atherton'});
 assert.equal(n.inspection_date,'2026-04-27');assert.equal(n.ratingLabel,'Conditional Pass');assert.equal(n.sortRank,1);assert.equal(n.score,null);assert.equal(n.zipcode,'94027');assert.equal(n.openViolations,2);
});
test('a newer ungraded county inspection never reuses an older pass',()=>{
 const n=normalizeSanMateo({recordId:'x',facilityName:'Cafe',visitResult:'Pass'},[{visitEndDateTime:'2026-10-01'}],{});assert.equal(n.ratingLabel,'Outcome not published');assert.equal(n.sortRank,null);assert.equal(n.score,null);
});
test('obvious schools and campus facilities are distinguishable from public dining',()=>{
 assert.equal(isInstitutional('MENLO ATHERTON HS'),true);assert.equal(isInstitutional('MENLO COLLEGE'),true);assert.equal(isInstitutional('LAUREL SCHOOL'),true);assert.equal(isInstitutional('MADEMOISELLE COLETTE'),false);assert.equal(isInstitutional('THE SANDWICH SPOT'),false);
});
