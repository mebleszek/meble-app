#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const context=require('./cloud-ci-context.js');
const impact=require('./cloud-ci-impact.js');
const prefix='tools/firebase-pilot/';
const refusalCodes=new Set(['CLOUD_OPERATOR_SOURCE_CHANGED','CLOUD42_SOURCE_CHANGED','CLOUD46C_DEPENDENCY_CHANGED','CLOUD46C_PACKAGE_CHANGED','CLOUD46D_REVIEWED_SOURCE_CHANGED','CLOUD46E_PACKAGE_CHANGED']);
function exact(code){
  assert.ok(refusalCodes.has(code),'Only named reviewed integrity refusals are allowed');
  return error=>error instanceof Error&&error.constructor===Error&&error.message===code;
}
function expectations(root,reference){
  for(const file of ['private-pilot-source.js','private-pilot-runner.mjs','private-pilot-execution.js']){
    const entry=reference[0].entries.find(e=>e.file===prefix+file);
    assert.ok(entry,'Historical operator pin missing');
    assert.equal(impact.actualHash(root,entry.file),entry.digest,'Reviewed private operator changed: '+file);
  }
  for(const spec of reference){
    assert.ok(fs.readFileSync(path.join(root,spec.file)).equals(spec.bytes),'Historical manifest changed: '+spec.file);
    if(spec.file.endsWith('cloud42-source-pins.json'))continue;
    for(const entry of spec.entries){
      if(spec.file.endsWith('cloud44-integrity.json')&&!entry.file.startsWith(prefix))continue;
      assert.equal(impact.actualHash(root,entry.file),entry.digest,'Reviewed operator/test dependency changed: '+entry.file);
    }
  }
  const dependencyChanged=reference[1].entries.some(entry=>impact.actualHash(root,entry.file)!==entry.digest);
  const propagated=dependencyChanged?'CLOUD46C_DEPENDENCY_CHANGED':'CLOUD42_SOURCE_CHANGED';
  const operator=require(path.join(root,prefix,'private-pilot-source.js'));
  const changed=impact.actualHash(root,'js/main-login.js')!==operator.MAIN_SHA256||impact.actualHash(root,prefix+'firestore-live-pilot.rules')!==operator.RULES_SHA256;
  return {operator:changed?'CLOUD_OPERATOR_SOURCE_CHANGED':null,c42:'CLOUD42_SOURCE_CHANGED',c:propagated,d:propagated,e:propagated};
}
async function withoutEffects(operation){
  const patched=[],calls=[];
  function block(object,key,readOnly){
    const original=object[key];if(typeof original!=='function')return;
    object[key]=function(...args){
      if(readOnly&&readOnly(args))return original.apply(this,args);
      calls.push(key);throw Error('UNEXPECTED_IO_'+key);
    };
    patched.push(()=>object[key]=original);
  }
  for(const object of [require('node:http'),require('node:https')])for(const key of ['request','get'])block(object,key);
  block(require('node:net').Socket.prototype,'connect');block(require('node:tls'),'connect');block(require('node:dgram'),'createSocket');block(globalThis,'fetch');
  for(const key of ['setTimeout','setInterval'])block(globalThis,key);
  for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])block(require('node:child_process'),key);
  for(const name of ['writeFile','appendFile','mkdir','rename','unlink','rm','rmdir','truncate','ftruncate','write','fsync','fdatasync','chmod','chown','symlink','link','copyFile','cp']){
    block(fs,name);block(fs,name+'Sync');block(fs.promises,name);
  }
  block(fs,'createWriteStream');
  const readOnly=args=>typeof args[1]==='number'?(args[1]&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_APPEND))===0:['r','rs','sr'].includes(args[1]??'r');
  block(fs,'open',readOnly);block(fs,'openSync',readOnly);block(fs.promises,'open',readOnly);
  require('node:module').syncBuiltinESMExports();
  let result,failure;
  try{result=await operation();}catch(error){failure=error;}
  finally{patched.reverse().forEach(restore=>restore());require('node:module').syncBuiltinESMExports();}
  assert.deepEqual(calls,[],'Changed source refused before any network, write, timer or child process');
  if(failure)throw failure;return result;
}
async function probe(root,codes){
  return withoutEffects(async()=>{
    if(codes.operator)assert.throws(()=>require(path.join(root,prefix,'private-pilot-source.js')).compile(),exact(codes.operator));
    const pilot=require(path.join(root,prefix,'cloud42-package.js'));
    for(const [module,code]of [['cloud42-package.js',codes.c42],['cloud46c-proof.js',codes.c],['cloud46d-candidate.js',codes.d],['cloud46e-authority.js',codes.e]]){
      if(code)assert.throws(()=>require(path.join(root,prefix,module)).inventory(),exact(code),module+': exact integrity refusal');
    }
    if(codes.c42){
      assert.throws(()=>pilot.verifyDeployedRules('auth-only','synthetic'),exact(codes.c42));
      assert.throws(()=>pilot.prepare({uid:'synthetic',role:'write',expiresAt:Date.now()+60000,grant:{},appAccess:{},control:null}),exact(codes.c42));
    }
    const gate=require(path.join(root,prefix,'cloud44-gate2.js'));
    for(const flags of [{},{live:true},{target:'production',approved:true}])assert.throws(()=>gate.executeProduction(flags),/^Error: CLOUD44_PRODUCTION_EXECUTION_DISABLED$/);
    if(codes.e){
      const connection=await import(pathToFileURL(path.join(root,prefix,'cloud46e-connection.mjs')).href);
      await assert.rejects(connection.openAuthorizedConnection({}),exact(codes.e));
      await assert.rejects(connection.recoverAuthorizedConnection({}),exact(codes.e));
    }
  });
}
async function main(){
  const root=path.resolve(__dirname,'..'), history=context.verifyHistorical(root);
  context.sdkPlan(root,history); // Every package.json test is assigned exactly once.
  const {completeTap,batchesForGroup,executionUnits}=require('./cloud-ci-emulators.js');
  const currentFiles=context.sdkPlan(root,history).find(group=>group.context==='current').files;
  const batches=batchesForGroup({context:'current',files:currentFiles});
  assert.deepEqual(batches.flat(),currentFiles,'Current SDK tests must all run exactly once');
  assert.deepEqual(batches.map(files=>files.length),[5,1,2],'Cloud42 must start in a fresh demo emulator');
  assert.deepEqual(batches[1],['cloud42-plan.test.mjs'],'Cloud42 cannot share server watch state with synchronization suites');
  assert.deepEqual(batchesForGroup({context:'historical',files:['a','b']}),[['a','b']]);
  assert.throws(()=>batchesForGroup({context:'current',files:['cloud42-plan.test.mjs']}),/CLOUD_CI_BATCH_PLAN_CHANGED/);
  const units=batches.flatMap((files,i)=>executionUnits({context:'current'},i+1,files));
  assert.deepEqual(units.flat(),currentFiles,'Each current SDK test must execute once');
  assert.deepEqual(units.map(files=>files.length),[5,1,1,1],'Two batch-3 files require separate emulator lifetimes');
  assert.deepEqual(units.slice(-2),[['cloud44-admin.test.mjs'],['cloud-sync-global.test.mjs']]);
  assert.deepEqual(executionUnits({context:'historical'},1,['a','b']),[['a','b']]);
  assert.throws(()=>executionUnits({context:'current'},3,['cloud-sync-global.test.mjs','cloud44-admin.test.mjs']),/CLOUD_CI_BATCH3_PLAN_CHANGED/);
  assert.throws(()=>executionUnits({context:'current'},3,['cloud44-admin.test.mjs']),/CLOUD_CI_BATCH3_PLAN_CHANGED/);
  console.log('PASS isolated [5,1,2] groups, separate batch-3 lifetimes, complete current SDK');
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
  const codes=expectations(root,impact.protection(root,history));
  await probe(root,codes);
  console.log('PASS current CLOUD boundary: '+JSON.stringify(codes)+'; no IO, production disabled; historical SHA '+context.HISTORICAL_SHA+' grants no current authority');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,expectations,exact,withoutEffects,probe};
