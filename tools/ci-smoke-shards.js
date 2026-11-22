'use strict';
// CI #1372 measurements; only the six newly split norm variants are estimates.
const fs=require('node:fs');
const SHARDS=36;
const PARTS=Object.freeze({
  "quote-exact-calculations-smoke.js": 9,
  "wycena-labor-pdf-smoke.js": 13,
  "wycena-labor-norms-smoke.js": 14,
  "quote-performance-smoke.js": 4
});
const timings=require('./ci-smoke-timings-1372.json');
function inventory(dir,historical=[]){
 const names=fs.readdirSync(dir).filter(n=>/-smoke\.js$/i.test(n)&&!historical.includes(n)).sort();
 if(new Set(names).size!==names.length)throw Error('CI_SMOKE_INVENTORY_DUPLICATE');
 for(const name of Object.keys(PARTS))if(!names.includes(name))throw Error('CI_SMOKE_PARTITION_SOURCE_MISSING:'+name);
 return names;
}
function units(names){
 if(!Array.isArray(names)||new Set(names).size!==names.length)throw Error('CI_SMOKE_PLAN_DUPLICATE');
 return names.flatMap(name=>Array.from({length:PARTS[name]||1},(_,i)=>PARTS[name]?name+'::'+(i+1):name));
}
function parseUnit(unit){
 const m=/^(.+?-smoke\.js)(?:::([1-9][0-9]*))?$/.exec(unit);
 if(!m)throw Error('CI_SMOKE_UNIT_INVALID:'+unit);
 const file=m[1],part=m[2]?Number(m[2]):0,count=PARTS[file]||1;
 if(part?(count<=1||part>count):count>1)throw Error('CI_SMOKE_PART_UNCONFIRMED:'+unit);
 return {file,part};
}
function weight(unit){
 parseUnit(unit);
 return timings.estimatedMs[unit]??timings.observedMs[unit]??1000;
}
function plan(names){
 const expected=units(names);
 const groups=Array.from({length:SHARDS},()=>[]),loads=Array(SHARDS).fill(0);
 const ordered=expected.slice().sort((a,b)=>weight(b)-weight(a)||a.localeCompare(b));
 for(const item of ordered){
  let index=0;for(let i=1;i<SHARDS;i++)if(loads[i]<loads[index])index=i;
  groups[index].push(item);loads[index]+=weight(item);
 }
 const actual=groups.flat();
 if(actual.length!==expected.length||new Set(actual).size!==expected.length||
    actual.slice().sort().join('|')!==expected.slice().sort().join('|'))throw Error('CI_SMOKE_PLAN_INCOMPLETE');
 if(loads.some(ms=>ms>=110000))throw Error('CI_SMOKE_GROUP_ESTIMATED_TOO_LONG:'+Math.max(...loads));
 return groups;
}
function assigned(dir,historical,index){
 if(!Number.isSafeInteger(index)||index<1||index>SHARDS)throw Error('CI_SMOKE_SHARD_INVALID');
 return plan(inventory(dir,historical))[index-1];
}
module.exports={SHARDS,PARTS,inventory,units,parseUnit,weight,plan,assigned};
