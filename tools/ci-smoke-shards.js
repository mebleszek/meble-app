'use strict';
// Deterministic complete partition of current smoke tests. Historical tests stay in their immutable job.
const fs=require('node:fs'),path=require('node:path');
const SHARDS=10;
// Six isolated smoke jobs: three pre-existing isolated checks and all measured tests above 120 s.
const isolated=['quote-performance-smoke.js','trusted-session-browser-smoke.js','empty-installation-browser-smoke.js',
 'quote-exact-calculations-smoke.js','wycena-labor-pdf-smoke.js','wycena-labor-norms-smoke.js'];
// CI #43651112609, 14.11.2026: observed single-run durations rounded to seconds.
// These are packing weights, not timeouts or PASS thresholds; calibrate with medians after CI.
const weights=Object.freeze({
 'quote-performance-smoke.js':115000,
 'trusted-session-browser-smoke.js':29000,
 'empty-installation-browser-smoke.js':42000,
 'project-selective-export-smoke.js':25000,
 'storage-recovery-browser-smoke.js':25000,
 'project-navigation-blockers-smoke.js':15000,
 'quote-exact-calculations-smoke.js':221000,
 'wycena-full-contracts-smoke.js':8000,
 'investor-navigation-exit-smoke.js':9000,
 'global-data-write-safety-smoke.js':6000,
 'project-session-initial-retry-smoke.js':8000,
 'wycena-labor-norms-smoke.js':156000,
 'project-clean-session-navigation-smoke.js':8000,
 'pixel-session-bookmarklet-smoke.js':8000,
 'offer-status-recovery-smoke.js':7000,
 'project-session-storage-pressure-smoke.js':7000,
 'wycena-quote-history-storage-maintenance-smoke.js':7000,
 'wycena-duplicate-offer-guard-smoke.js':6000,
 'project-pcv-ui-activation-smoke.js':6000,
 'project-session-restored-proof-smoke.js':6000,
 'investor-list-delete-smoke.js':6000,
 'android-globals-recovery-browser-smoke.js':23000,
 'android-investor-isolation-smoke.js':5000,
 'android-startup-auth-browser-smoke.js':59000,
 'application-project-exit-smoke.js':5000,
 'code-global-catalogs-smoke.js':23000,
 'local-cabinet-native-browser-smoke.js':55000,
 'quote-final-corrections-smoke.js':71000,
 'quote-labor-single-truth-smoke.js':17000,
 'synthetic-global-rebuild-browser-smoke.js':9000,
 'android-local-first-browser-smoke.js':58000,
 'project-exit-cold-start-browser-smoke.js':5000,
 'quote-final-material-browser-smoke.js':19000,
 'application-session-browser-smoke.js':7000,
 'android-safe-sw-update-smoke.js':52000,
 'labor-catalog-local-first-browser-smoke.js':23000,
 'labor-work-plan-smoke.js':12000,
 'wycena-labor-pdf-smoke.js':175000
});
function inventory(dir,historical=[]){
 const names=fs.readdirSync(dir).filter(n=>/-smoke\.js$/i.test(n)&&!historical.includes(n)).sort();
 if(new Set(names).size!==names.length)throw Error('CI_SMOKE_INVENTORY_DUPLICATE');
 for(const name of isolated)if(!names.includes(name))throw Error('CI_SMOKE_ISOLATED_MISSING:'+name);
 return names;
}
function plan(names){
 if(!Array.isArray(names)||new Set(names).size!==names.length)throw Error('CI_SMOKE_PLAN_DUPLICATE');
 for(const [name,ms] of Object.entries(weights)){
  if(ms>120000&&!isolated.includes(name))throw Error('CI_SMOKE_SLOW_TEST_NOT_ISOLATED:'+name);
 }
 const groups=Array.from({length:SHARDS},()=>[]);
 for(let i=0;i<isolated.length;i++)groups[i].push(isolated[i]);
 const remaining=names.filter(n=>!isolated.includes(n)).sort((a,b)=>(weights[b]||1000)-(weights[a]||1000)||a.localeCompare(b));
 const loads=groups.map(group=>group.reduce((total,name)=>total+(weights[name]||1000),0));
 for(const name of remaining){
  let i=isolated.length;for(let j=isolated.length+1;j<SHARDS;j++)if(loads[j]<loads[i])i=j;
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
