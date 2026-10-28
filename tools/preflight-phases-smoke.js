#!/usr/bin/env node
'use strict';
// Exercise the real phase runner with synthetic audits, never the full Preflight.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const names = ['Składnia JavaScript', 'Kolejność ładowania', 'Smoke testy', 'Zależności', 'Storage'];
function check(failures){
  const original = fs.readFileSync(path.join(__dirname, 'preflight.js'), 'utf8');
  const declaration = original.match(/const phases = \[\n([\s\S]*?)\n\];/);
  assert.ok(declaration, 'Locate only the configured phase list');
  assert.deepEqual([...declaration[1].matchAll(/\['([^']+)', phase\w+\]/g)].map(match=>match[1]), names, 'Preserve the real phase order');
  let out = '', err = '', status = 0;
  const exit = {};
  const fixtureModule = {exports:{}};
  const localRequire = name=>require(name);
  localRequire.main = fixtureModule;
  const context = {
    __dirname, module:fixtureModule, require:localRequire,
    process:{stdout:{write:text=>{out+=text;}}, exit:code=>{status=code; throw exit;}},
    console:{log:(...args)=>{out+=args.join(' ')+'\n';}, error:(...args)=>{err+=args.join(' ')+'\n';}},
    fixtures:names.map((name, index)=>[name, ()=>{
      out+='VISITED:'+index+'\n';
      if(failures.includes(index)) throw new Error('SYNTHETIC_FAILURE:'+index);
      return 'SYNTHETIC_PASS:'+index;
    }]),
  };
  // Replace only phase inputs; run the actual loop, reporting and CLI exit logic.
  const source = original.replace(declaration[0], ()=> 'const phases = fixtures;');
  try{vm.runInNewContext(source, context, {filename:'preflight.js', timeout:1000});}
  catch(error){if(error !== exit) throw error;}
  assert.equal(status, failures.length ? 1 : 0, 'Any mandatory failure must fail the process');
  assert.deepEqual([...out.matchAll(/VISITED:(\d+)/g)].map(match=>Number(match[1])), [0,1,2,3,4], 'Every phase executes exactly once, in order, after failures');
  for(const [index, name] of names.entries()){
    assert.ok(out.includes('[RUN ] '+name+' ... '), 'Every phase is reported');
    assert.equal(err.includes('SYNTHETIC_FAILURE:'+index), failures.includes(index));
    assert.equal(out.includes('SYNTHETIC_PASS:'+index), !failures.includes(index));
  }
  assert.equal((out.match(/FAIL \(/g)||[]).length, failures.length);
  assert.equal((out.match(/OK \(/g)||[]).length, names.length-failures.length);
  if(failures.length){
    assert.ok(err.includes(`PRE-FLIGHT FAIL — ${failures.length}/5 faz FAIL; wykonano wszystkie niezależne fazy (`));
    assert.ok(!out.includes('PRE-FLIGHT PASS'));
    assert.ok(!err.includes('zatrzymano po'));
  }else{
    assert.ok(out.includes('PRE-FLIGHT PASS — wszystkie kontrole zakończone poprawnie'));
    assert.equal(err, '');
  }
}
function main(){
  // Exhaust all 32 PASS/FAIL combinations, including first/middle/last/all FAIL.
  for(let mask=0; mask<32; mask++) check(names.map((_,i)=>i).filter(i=>mask & (1<<i)));
  console.log('Preflight phase aggregation: 32/32 combinations PASS; all audits continue, failures remain failures');
}
if(require.main === module) main();
module.exports = {main};
