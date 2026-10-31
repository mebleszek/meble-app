'use strict';
// Deterministic complete partition of current smoke tests. Historical tests stay in their immutable job.
const fs=require('node:fs'),path=require('node:path');
const SHARDS=7;
const isolated=['quote-performance-smoke.js','trusted-session-browser-smoke.js','empty-installation-browser-smoke.js'];
const weights=Object.freeze({
 'quote-performance-smoke.js':74000,'trusted-session-browser-smoke.js':30000,'empty-installation-browser-smoke.js':33000,
 'project-selective-export-smoke.js':21000,'storage-recovery-browser-smoke.js':20000,
 'project-navigation-blockers-smoke.js':15000,'quote-exact-calculations-smoke.js':12000,
 'wycena-full-contracts-smoke.js':11000,'investor-navigation-exit-smoke.js':9000,
 'global-data-write-safety-smoke.js':8000,'project-session-initial-retry-smoke.js':8000,
 'wycena-labor-norms-smoke.js':8000,'project-clean-session-navigation-smoke.js':8000,
 'pixel-session-bookmarklet-smoke.js':8000,'offer-status-recovery-smoke.js':7000,
 'project-session-storage-pressure-smoke.js':7000,'wycena-quote-history-storage-maintenance-smoke.js':7000,
 'wycena-duplicate-offer-guard-smoke.js':7000,'project-pcv-ui-activation-smoke.js':6000,
 'project-session-restored-proof-smoke.js':6000,'investor-list-delete-smoke.js':6000
});
function inventory(dir,historical=[]){
 const names=fs.readdirSync(dir).filter(n=>/-smoke\.js$/i.test(n)&&!historical.includes(n)).sort();
 if(new Set(names).size!==names.length)throw Error('CI_SMOKE_INVENTORY_DUPLICATE');
 for(const name of isolated)if(!names.includes(name))throw Error('CI_SMOKE_ISOLATED_MISSING:'+name);
 return names;
}
function plan(names){
 if(!Array.isArray(names)||new Set(names).size!==names.length)throw Error('CI_SMOKE_PLAN_DUPLICATE');
 const groups=Array.from({length:SHARDS},()=>[]);
 for(let i=0;i<isolated.length;i++)groups[i].push(isolated[i]);
 const remaining=names.filter(n=>!isolated.includes(n)).sort((a,b)=>(weights[b]||1000)-(weights[a]||1000)||a.localeCompare(b));
 const loads=[weights[isolated[0]],weights[isolated[1]],weights[isolated[2]],0,0,0,0];
 for(const name of remaining){
  let i=3;for(let j=4;j<SHARDS;j++)if(loads[j]<loads[i])i=j;
  groups[i].push(name);loads[i]+=weights[name]||1000;
 }
 const all=groups.flat();
 if(all.length!==names.length||new Set(all).size!==names.length||names.some(n=>!all.includes(n)))throw Error('CI_SMOKE_PLAN_INCOMPLETE');
 return groups;
}
function assigned(dir,historical,index){
 if(!Number.isSafeInteger(index)||index<1||index>SHARDS)throw Error('CI_SMOKE_SHARD_INVALID');
 return plan(inventory(dir,historical))[index-1];
}
module.exports={SHARDS,isolated,inventory,plan,assigned};
