#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {compile,MAIN_SHA256,RULES_SHA256}=require('./firebase-pilot/private-pilot-source.js');
async function main(){
 const a=compile(),b=compile();assert.deepEqual(a,b);new vm.Script(a.source);
 assert.equal(a.mainSha256,MAIN_SHA256);assert.equal(a.rulesSha256,RULES_SHA256);
 assert.match(a.source,/return \(\/\/ Operator-only/);
 const root=path.resolve(__dirname,'..');
 for(const name of ['index.html','js/main-login.js','js/boot.js','js/app.js','tools/index-load-groups.js']){
  assert.doesNotMatch(fs.readFileSync(path.join(root,name),'utf8'),/private-pilot-(?:execution|runner|source)/,name);
 }
 const {openPrivatePilot}=await import('./firebase-pilot/private-pilot-runner.mjs');
 const untouched=new Proxy({},{get(){throw Error('Page must not be touched before refusing LIVE');}});
 for(const address of ['https://mebleszek.github.io/meble-app/index.html','http://example.invalid/index.html','http://127.0.0.1/index.html?live=1']){
  await assert.rejects(openPrivatePilot(untouched,address),/CLOUD_LIVE_TRANSPORT_DISABLED/);
 }
 const driver=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'firebase-pilot/private-pilot-execution.js'),'utf8'));
 let calls=0;
 const instance=driver(async()=>{calls++;throw Error('AUTH_ACCESS_REVOKED');},[]);
 assert.equal(calls,0,'definition and construction must not start a pilot');
 assert.deepEqual(JSON.parse(JSON.stringify(await instance.execute({role:'write',approval:{}}))),{ok:false,code:'AUTH_ACCESS_REVOKED'});
 assert.equal(calls,1);assert.equal((await instance.execute({role:'write',approval:{}})).code,'CLOUD_OPERATION_LIMIT');
 const malformed=driver(()=>{throw Error('Unexpected session access');},[]);
 assert.equal((await malformed.execute({role:'write',approval:{},extra:true})).code,'CLOUD_SCOPE_INVALID');
 malformed.close();assert.equal((await malformed.execute({role:'read',approval:{}})).code,'CLOUD_CLIENT_CLOSED');
 console.log('CLOUD-4.1 private artifact pin, inert startup, closed scope, one-shot and LIVE refusal: PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
