#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const context=require('./cloud-ci-context.js');
async function main(){
  const root=path.resolve(__dirname,'..'), history=context.verifyHistorical(root);
  context.sdkPlan(root,history); // Every package.json test is assigned exactly once.
  const {completeTap}=require('./cloud-ci-emulators.js');
  const tap='# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(completeTap(tap),true);
  for(const name of ['fail','cancelled','skipped','todo'])assert.equal(completeTap(tap.replace('# '+name+' 0','# '+name+' 1')),false);
  assert.equal(completeTap(''),false);assert.equal(completeTap(tap.replace('# tests 1','# tests 0')),false);
  const clean=context.cleanEnvironment({PATH:process.env.PATH,FIREBASE_TOKEN:'synthetic',GOOGLE_APPLICATION_CREDENTIALS:'synthetic',CLOUD43A_PRIVATE_SOURCE:'synthetic',CLOUD_CI_HISTORY_ROOT:history});
  assert.equal(clean.GCLOUD_PROJECT,'demo-meble-app');assert.equal(clean.CLOUD_CI_HISTORY_ROOT,history);
  for(const key of ['FIREBASE_TOKEN','GOOGLE_APPLICATION_CREDENTIALS','CLOUD43A_PRIVATE_SOURCE'])assert.equal(Object.hasOwn(clean,key),false);
  assert.throws(()=>context.verifyHistorical(root,root),/^Error: CLOUD_CI_ISOLATION_REQUIRED$/);
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-ci-wrong-revision-'));
  try{
    context.git(scratch,['init','--quiet']);
    context.git(scratch,['-c','user.name=CI fixture','-c','user.email=fixture@example.invalid','commit','--quiet','--allow-empty','-m','Unapproved synthetic revision']);
    assert.throws(()=>context.verifyHistorical(root,scratch),/^Error: CLOUD_CI_HISTORY_SHA_MISMATCH$/);
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
  const patched=[], calls=[];
  function block(object,key){
    const original=object[key];if(typeof original!=='function') return;
    object[key]=()=>{calls.push(key);throw Error('UNEXPECTED_IO_'+key);};patched.push(()=>object[key]=original);
  }
  for(const object of [require('node:http'),require('node:https')]) for(const key of ['request','get'])block(object,key);
  block(require('node:net').Socket.prototype,'connect');block(require('node:tls'),'connect');block(globalThis,'fetch');
  for(const key of ['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync'])block(fs,key);
  try{
    const pilot=require('./firebase-pilot/cloud42-package.js');
    for(const module of ['cloud42-package.js','cloud46c-proof.js','cloud46d-candidate.js','cloud46e-authority.js']){
      assert.throws(()=>require('./firebase-pilot/'+module).inventory(),/^Error: CLOUD42_SOURCE_CHANGED$/,module+': new sources cannot inherit historical authority');
    }
    assert.throws(()=>pilot.verifyDeployedRules('auth-only','synthetic'),/^Error: CLOUD42_SOURCE_CHANGED$/);
    assert.throws(()=>pilot.prepare({uid:'synthetic',role:'write',expiresAt:Date.now()+60000,grant:{},appAccess:{},control:null}),/^Error: CLOUD42_SOURCE_CHANGED$/);
    const gate=require('./firebase-pilot/cloud44-gate2.js');
    for(const flags of [{},{live:true},{target:'production',approved:true}])assert.throws(()=>gate.executeProduction(flags),/^Error: CLOUD44_PRODUCTION_EXECUTION_DISABLED$/);
    const connection=await import(pathToFileURL(path.join(__dirname,'firebase-pilot/cloud46e-connection.mjs')).href);
    await assert.rejects(connection.openAuthorizedConnection({}),/^Error: CLOUD42_SOURCE_CHANGED$/);
    await assert.rejects(connection.recoverAuthorizedConnection({}),/^Error: CLOUD42_SOURCE_CHANGED$/);
    assert.deepEqual(calls,[],'Changed source refused before remote IO or journal writes');
  }finally{patched.reverse().forEach(restore=>restore());}
  console.log('PASS current CLOUD boundary: exact SOURCE_CHANGED, no IO, production disabled; historical SHA '+context.HISTORICAL_SHA);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
