#!/usr/bin/env node
'use strict';
// Every current smoke file is present; partitioned files run ALL their cases exactly once.
const assert=require('node:assert/strict');
const shards=require('./ci-smoke-shards.js'),context=require('./cloud-ci-context.js');
const names=shards.inventory(__dirname,context.historicalSmoke);
const units=shards.units(names),groups=shards.plan(names),all=groups.flat();
assert.equal(shards.SHARDS,36);
assert.equal(shards.weight('startup-assets-browser-smoke.js'),65000,'Startup inactivity checks must not be packed as an unmeasured 1-second test');
assert.equal(groups.length,shards.SHARDS);
const batches=require('./ci-smoke-batches');
assert.equal(batches.plan().length,24);
assert.deepEqual(batches.plan().flat().sort((a,b)=>a-b),Array.from({length:36},(_,i)=>i+1));
for(const [index,batch]of batches.plan().entries()){
 assert.deepEqual(batches.select(index+1),batch);assert.ok(batch.length<=2);
 if(index<12)assert.deepEqual(batch,[index+1],'Heavy shards retain isolated runners');
 else assert.ok(batch.reduce((sum,id)=>sum+groups[id-1].reduce((n,unit)=>n+shards.weight(unit),0),0)<100000,'Paired smoke budget drift requires replanning');
}
for(const bad of [0,25,-1,1.5,NaN])assert.throws(()=>batches.select(bad),/CI_SMOKE_BATCH_INVALID/);
const norms=require('./wycena-labor-norms-smoke');
assert.equal(norms.tests.length,shards.PARTS['wycena-labor-norms-smoke.js'],'Every existing norm case has its own mandatory partition');

assert.equal(all.length,units.length);
assert.deepEqual([...new Set(all)].sort(),units.slice().sort());
for(const [file,count]of Object.entries(shards.PARTS)){
 assert.ok(names.includes(file),'Partitioned test missing: '+file);
 const sections=units.map(unit=>shards.parseUnit(unit)).filter(unit=>unit.file===file);
 assert.deepEqual(sections.map(unit=>unit.part),Array.from({length:count},(_,i)=>i+1));
 assert.ok(!all.includes(file),'Unpartitioned copy must not execute: '+file);
}
for(let i=1;i<=shards.SHARDS;i++){
 assert.deepEqual(shards.assigned(__dirname,context.historicalSmoke,i),groups[i-1]);
 const estimated=groups[i-1].reduce((sum,item)=>sum+shards.weight(item),0);
 assert.ok(estimated<110000,'Estimated CI group too long: '+i+'='+estimated);
}
assert.throws(()=>shards.plan([...names,names[0]]),/CI_SMOKE_PLAN_DUPLICATE/);
assert.throws(()=>shards.assigned(__dirname,[],0),/CI_SMOKE_SHARD_INVALID/);
assert.throws(()=>shards.assigned(__dirname,[],shards.SHARDS+1),/CI_SMOKE_SHARD_INVALID/);
for(const unit of all)assert.ok(names.includes(shards.parseUnit(unit).file));
const future='future-security-regression-smoke.js';
assert.equal(shards.plan([...names,future]).flat().filter(unit=>unit===future).length,1);
assert.ok(!all.some(unit=>context.historicalSmoke.includes(shards.parseUnit(unit).file)));
// All signed DEMO matrix cases must be mandatory, one process each.
const fs=require('node:fs'),path=require('node:path');
const cloudRunner=require('./cloud-ci-emulators.js');
const flow=fs.readFileSync(path.join(__dirname,'../.github/workflows/preflight-js.yml'),'utf8');
const currentFlow=flow.slice(flow.indexOf('  firebase-current-shards:'),flow.indexOf('  playwright-sync-ui:'));
assert.ok(currentFlow.includes('--segment=${{ matrix.segment }}'));
const scheduled=Array.from(currentFlow.matchAll(/- \{batch: [123], segment: '([^']+)'\}/g),row=>row[1]);
assert.deepEqual(scheduled,cloudRunner.CURRENT_SEGMENTS);
for(const count of [4,9,13]){
 const groups=Array.from({length:count},(_,i)=>require('./ci-test-parts').select(count,['--ci-part='+(i+1)]));
 const selected=Array.from({length:83},(_,i)=>groups.filter(group=>group.includes(i)).length);
 assert.ok(selected.every(n=>n===1),'Every independent case must belong to exactly one partition');
 assert.throws(()=>require('./ci-test-parts').select(count,['--ci-part='+(count+1)]),/CI_TEST_PART_INVALID/);
}
const p0b=require('./p0b-ci-plan').plan(path.join(__dirname,'firebase-pilot'));
const p0bFlow=flow.slice(flow.indexOf('  firebase-p0b:'),flow.indexOf('  firebase-current:'));
const p0bMatrix=/segment: \[([^\]]+)\]/.exec(p0bFlow)[1].split(',').map(s=>s.trim());
assert.deepEqual(p0bMatrix,p0b.map(row=>row.id));
assert.equal(p0b.flatMap(row=>row.names).length,47);
assert.ok(p0bFlow.includes('--p0b=${{ matrix.segment }}'));
assert.ok(flow.includes('needs: [safety, firebase-current-shards, playwright-sync-ui, firebase-p0b, documents]'));
assert.ok(flow.includes('const names=["safety","firebase-current-shards","playwright-sync-ui","firebase-p0b"];'));
for(const row of p0b)assert.deepEqual(require('./p0b-ci-plan').select(path.join(__dirname,'firebase-pilot'),row.id),row);
assert.throws(()=>require('./p0b-ci-plan').select(path.join(__dirname,'firebase-pilot'),'unknown'),/P0B_CI_SEGMENT_INVALID/);
console.log('CI SHARD COVERAGE PASS '+names.length+' current smoke files, '+units.length+' complete execution units, '+shards.SHARDS+' disjoint groups, all partition cases mandatory');
