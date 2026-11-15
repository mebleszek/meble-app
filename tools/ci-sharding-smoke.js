#!/usr/bin/env node
'use strict';
// Every current smoke file is present; partitioned files run ALL their cases exactly once.
const assert=require('node:assert/strict');
const shards=require('./ci-smoke-shards.js'),context=require('./cloud-ci-context.js');
const names=shards.inventory(__dirname,context.historicalSmoke);
const units=shards.units(names),groups=shards.plan(names),all=groups.flat();
assert.equal(shards.SHARDS,36);
assert.equal(groups.length,shards.SHARDS);
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
console.log('CI SHARD COVERAGE PASS '+names.length+' current smoke files, '+units.length+' complete execution units, '+shards.SHARDS+' disjoint groups, all partition cases mandatory');
