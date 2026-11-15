'use strict';
// CI #43756306571: real elapsed milliseconds; partition weights require post-CI calibration.
const fs=require('node:fs');
const SHARDS=36;
const PARTS=Object.freeze({
  "quote-exact-calculations-smoke.js": 9,
  "wycena-labor-pdf-smoke.js": 13,
  "wycena-labor-norms-smoke.js": 4,
  "quote-performance-smoke.js": 4
});
const weights=Object.freeze({
  "android-globals-recovery-browser-smoke.js": 17710,
  "android-investor-isolation-smoke.js": 4565,
  "android-local-first-browser-smoke.js": 65862,
  "android-safe-sw-update-smoke.js": 45121,
  "android-startup-auth-browser-smoke.js": 66029,
  "application-project-exit-smoke.js": 3031,
  "code-global-catalogs-smoke.js": 13603,
  "empty-installation-browser-smoke.js": 40814,
  "empty-installation-smoke.js": 3499,
  "global-data-write-safety-smoke.js": 5712,
  "investor-list-delete-smoke.js": 4475,
  "investor-navigation-exit-smoke.js": 5692,
  "labor-appliance-separate-automats-smoke.js": 3690,
  "labor-catalog-local-first-browser-smoke.js": 23454,
  "labor-work-plan-smoke.js": 21553,
  "local-cabinet-native-browser-smoke.js": 63637,
  "offer-status-recovery-smoke.js": 5326,
  "pixel-session-bookmarklet-smoke.js": 4867,
  "project-clean-session-navigation-smoke.js": 5636,
  "project-exit-cold-start-browser-smoke.js": 7025,
  "project-navigation-blockers-smoke.js": 11051,
  "project-pcv-ui-activation-smoke.js": 4407,
  "project-selective-export-smoke.js": 15913,
  "project-session-initial-retry-smoke.js": 5136,
  "project-session-restored-proof-smoke.js": 4022,
  "project-session-storage-pressure-smoke.js": 4354,
  "quote-exact-calculations-smoke.js": 404535,
  "quote-final-corrections-smoke.js": 56000,
  "quote-final-material-browser-smoke.js": 18502,
  "quote-labor-single-truth-smoke.js": 9610,
  "quote-performance-smoke.js": 134921,
  "storage-recovery-browser-smoke.js": 14625,
  "synthetic-global-rebuild-browser-smoke.js": 8086,
  "trusted-session-browser-smoke.js": 34300,
  "wycena-duplicate-offer-guard-smoke.js": 5739,
  "wycena-full-contracts-smoke.js": 13442,
  "wycena-labor-norms-smoke.js": 148307,
  "wycena-labor-pdf-smoke.js": 330007,
  "wycena-quote-history-storage-maintenance-smoke.js": 6662
});
const partWeights=Object.freeze({
  "quote-exact-calculations-smoke.js": [68000,68000,68000,68000,68000,68000,55000,38000,27000],
  "wycena-labor-pdf-smoke.js": [105000, 105000, 105000, 105000, 105000, 105000, 105000, 105000, 105000, 105000, 105000, 105000, 105000],
  "wycena-labor-norms-smoke.js": [43000,43000,43000,87000],
  "quote-performance-smoke.js": [
    41000,
    41000,
    41000,
    41000
  ]
});
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
 const {file,part}=parseUnit(unit);
 return part?partWeights[file][part-1]:weights[file]||1000;
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
