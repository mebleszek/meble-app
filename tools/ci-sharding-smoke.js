#!/usr/bin/env node
'use strict';
// Regression: all current smoke files are classified exactly once, including future tests.
const assert=require('node:assert/strict'),path=require('node:path');
const context=require('./cloud-ci-context.js'),shards=require('./ci-smoke-shards.js');
const tools=__dirname,names=shards.inventory(tools,context.historicalSmoke);
const groups=shards.plan(names),all=groups.flat();
assert.equal(shards.SHARDS,10);
assert.equal(groups.length,shards.SHARDS);
assert.equal(all.length,names.length);
assert.deepEqual([...new Set(all)].sort(),names);
for(let i=1;i<=shards.SHARDS;i++)assert.deepEqual(shards.assigned(tools,context.historicalSmoke,i),groups[i-1]);
for(let i=0;i<shards.isolated.length;i++)assert.deepEqual(groups[i],[shards.isolated[i]]);
assert.throws(()=>shards.plan([...names,names[0]]),/CI_SMOKE_PLAN_DUPLICATE/);
assert.throws(()=>shards.assigned(tools,[],0),/CI_SMOKE_SHARD_INVALID/);
assert.throws(()=>shards.assigned(tools,[],shards.SHARDS+1),/CI_SMOKE_SHARD_INVALID/);
for(const name of ['quote-exact-calculations-smoke.js','wycena-labor-pdf-smoke.js','wycena-labor-norms-smoke.js']){
 assert.ok(shards.isolated.includes(name),'Long test must be isolated: '+name);
}
const future='future-security-regression-smoke.js';
assert.equal(shards.plan([...names,future]).flat().filter(n=>n===future).length,1);
assert.ok(!groups.flat().some(n=>context.historicalSmoke.includes(n)));
console.log('CI SHARD COVERAGE PASS '+all.length+' current smoke tests, '+shards.SHARDS+' disjoint groups, long tests isolated, future test auto-assigned');
