'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{world}=require('./trusted-main-login-smoke');
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('RECOVERY_SCOPE_NOT_READY');}
async function fatal(stall=false){let failed=false,opened=0,releaseReadonly;const r=world({},null,{beforeMain(w){
 if(stall){const create=w.FC.cloudAccessVerifier.create;w.FC.cloudAccessVerifier.create=(...args)=>{const verifier=create(...args);let calls=0;return {...verifier,verify:identity=>++calls===2?new Promise(resolve=>{releaseReadonly=()=>resolve(verifier.verify(identity));}):verifier.verify(identity)};};}
 w.FC.applicationStartup={beforeBusiness:async()=>{},revokeCloud(){},recordFailure(){},diagnostics:()=>({firstError:{stage:'initial-global-revision',code:'GLOBAL_ALIAS_CONFLICT'}}),
  start:async()=>{failed=true;throw Object.assign(Error('PRIVATE'),{code:'GLOBAL_ALIAS_CONFLICT'});},canRecoverGlobals:()=>failed,
  async openLocalFirstRecovery(){await w.__FC_RECOVERY_ACCESS__.verify();opened++;return {contains:()=>true,remove(){},dispatchEvent(){}};}};
 }});await until(()=>r.nodes['auth-google']?.disabled===false);r.input('click','auth-google');await until(()=>r.nodes['auth-recovery']?.hidden===false);
 return {...r,get opened(){return opened;},releaseReadonly:()=>releaseReadonly()};
}
(async()=>{
 const r=await fatal();try{
  assert.equal(r.w.__FC_MAIN_ACCESS__.isValid(),false);assert.equal(r.w.__FC_RECOVERY_ACCESS__.isValid(),false);
  r.input('click','auth-recovery');await until(()=>r.opened===1);assert.equal(r.w.__FC_RECOVERY_ACCESS__.isValid(),true);assert.equal(r.w.__FC_MAIN_ACCESS__.isValid(),false);
  r.shared.rows.set('fc_synthetic_private_v1','PRIVATE_EXACT');assert.equal(r.w.__FC_RECOVERY_ACCESS__.readNative('fc_synthetic_private_v1'),'PRIVATE_EXACT');
  assert.throws(()=>r.w.__FC_RECOVERY_ACCESS__.readNative('firebase:authUser:synthetic'),/RESCUE_READ_SCOPE/);assert.throws(()=>r.w.__FC_RECOVERY_ACCESS__.readNative('meble_access_profile_v1'),/RESCUE_READ_SCOPE/);
  assert.throws(()=>r.w.localStorage.setItem('fc_synthetic_private_v1','OVERWRITE'),/AUTH_ACCESS_REVOKED/);assert.equal(r.shared.rows.get('fc_synthetic_private_v1'),'PRIVATE_EXACT');
  r.deny();assert.equal(r.w.__FC_RECOVERY_ACCESS__.isValid(),false);assert.throws(()=>r.w.__FC_RECOVERY_ACCESS__.readNative('fc_synthetic_private_v1'));
 }finally{r.close();}console.log('PASS fatal desktop: separate fresh server lease/profile readonly proof, no main gate revival or business WRITE; denial revokes scope');
 const expired=await fatal();try{expired.input('click','auth-recovery');await until(()=>expired.opened===1);expired.advance(45001);assert.equal(expired.w.__FC_RECOVERY_ACCESS__.isValid(),false);assert.equal(expired.w.__FC_MAIN_ACCESS__.isValid(),false);}finally{expired.close();}
 const retried=await fatal();try{retried.input('click','auth-google');await until(()=>retried.nodes['auth-error'].textContent.includes('AUTH_RELOAD_REQUIRED'));assert.equal(retried.nodes['auth-recovery'].hidden,false);assert.equal(retried.w.__FC_MAIN_ACCESS__.isValid(),false);retried.input('click','auth-recovery');await until(()=>retried.opened===1);}finally{retried.close();}
 const stalled=await fatal(true);try{stalled.input('click','auth-recovery');stalled.advance(10001);await until(()=>stalled.nodes['auth-recovery'].disabled===false);stalled.releaseReadonly();await new Promise(resolve=>setImmediate(resolve));assert.equal(stalled.opened,0);assert.equal(stalled.w.__FC_RECOVERY_ACCESS__.isValid(),false);}finally{stalled.close();}
 console.log('PASS fatal recovery lease expiry refuses reads without restarting business or granting indefinite access');
 const changed=await fatal();try{const before=changed.shared.rows.get('meble_access_profile_v1');changed.shared.rows.set('meble_access_profile_v1','{"version":1,"uid":"foreign"}');changed.input('click','auth-recovery');await until(()=>changed.nodes['auth-recovery'].disabled===false);assert.equal(changed.opened,0);assert.equal(changed.w.__FC_RECOVERY_ACCESS__.isValid(),false);changed.shared.rows.set('meble_access_profile_v1',before);}finally{changed.close();}
 console.log('PASS changed owner receipt cannot obtain read scope or initialize a replacement profile');
 // Exercise the real runtime function with isolated boundary dependencies: a
 // pending/failed close must never mint recovery readiness or hide first error.
 const runtimeSource=fs.readFileSync('sync/application-runtime.mjs','utf8').replace(/^import [^;]+;\n/gm,'').replace(/^export /gm,'');
 for(const closeFails of [false,true]){
  let finish,settled=false,ready=false;const stops=[],original=Object.assign(Error('PRIVATE_ORIGINAL'),{code:'GLOBAL_ALIAS_CONFLICT'}),rows={fc_projects_v1:'[]'};
  const closing=new Promise((resolve,reject)=>{finish=()=>closeFails?reject(Error('PRIVATE_CLOSE')):resolve();});
  const deps={assertApplicationConnection:()=>({uid:'synthetic-owner'}),applicationKeys:()=>[],applicationInstallation:async()=>({binding:{},confirm(){},release(){stops.push('release');}}),
   openLocalFirstStore:async()=>({readApplication:async()=>({rows}),snapshot:async()=>({replica:null}),exclusive:fn=>fn(),close(){stops.push('store');}}),
   createGlobalChannel:()=>({read:async()=>{throw {code:'GLOBAL_NOT_FOUND'};}}),createEmulatorProjectDiscovery:()=>({}),createApplicationReplication:()=>({close:()=>closing}),createApplicationCommitter:()=>({}),
   installEmulatorApplicationAuthority:async()=>({rows:()=>rows,close(){stops.push('authority');}})};
  const run=new Function('deps','with(deps){'+runtimeSource+';return startApplicationRuntime;}')(deps);
  const pending=run({window:{FC:{globalDataContract:{schemas:{},sources:{},capture(){throw original;}},businessProjectContract:{}},__FC_MAIN_ACCESS__:{assert(){}},navigator:{onLine:true}},writer:{db:{app:{}}},reader:{db:{app:{}}},name:'meble-lf-test-close',ownerUid:'synthetic-owner',onFailureQuiescent(){ready=true;}}).then(()=>{throw Error('Unexpected start');},e=>{settled=true;return e;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(ready,false);finish();assert.equal(await pending,original);assert.deepEqual(stops,['authority','store','release']);assert.equal(ready,!closeFails);
 }
 console.log('PASS real runtime waits for synchronization cleanup; failed cleanup preserves original globals error and refuses recovery readiness');
 {
  let beforeTransaction,finish,checks=0;const rows={fc_projects_v1:'[]'},authority={status:()=>({transactionPending:false,incomingPending:false}),close(){}};
  const deps={fail:code=>{throw Object.assign(Error(code),{code});},applicationKeys:()=>[],applicationInstallation:async()=>({binding:{},confirm(){},release(){}}),
   openLocalFirstStore:async()=>({readApplication:async()=>({rows}),close(){}}),createApplicationCommitter:()=>({}),verifyExclusiveClient:async()=>{checks++;},
   installOfflineEmulatorApplicationAuthority:async options=>{beforeTransaction=options.beforeTransaction;return authority;},
   installApplicationWriteBoundary:()=>({run(){},busy:()=>false,close(){}}),createApplicationActionBinding:()=>({})};
  const run=new Function('deps','with(deps){'+runtimeSource+';return startApplicationRuntime;}')(deps),runtime=await run({window:{FC:{globalDataContract:{},businessProjectContract:{},applicationSyncActions:{install(){}}},__FC_MAIN_ACCESS__:{assert(){}},navigator:{onLine:false},addEventListener(){},removeEventListener(){}},name:'meble-lf-test-read-lock',ownerUid:'synthetic-owner',boot:{restored:true,rows:()=>rows}});
  const pending=runtime.withRescueRead(()=>new Promise(resolve=>{finish=resolve;}));assert.throws(()=>beforeTransaction(),e=>e.code==='LF_APPLICATION_BUSY');finish(true);await pending;await beforeTransaction();assert.equal(checks,1);
  await assert.rejects(runtime.withRescueRead(async()=>{throw Error('synthetic read failure');}));await beforeTransaction();assert.equal(checks,2);
 }
 console.log('PASS normal runtime recovery read reserves the existing write boundary and releases it after success/failure without changing synchronization policy');
 {
  const rows={fc_projects_v1:'[]'},instances=[],listeners=new Map();let finish,binds=0,peer=false,fences=0;
  const closing=new Promise(resolve=>{finish=resolve;}),authority={rows:()=>rows,status:()=>({transactionPending:false,incomingPending:false}),assertIdle(){},close(){},resume(){}};
  const deps={fail:code=>{throw Object.assign(Error(code),{code});},copy:structuredClone,applicationKeys:()=>[],applicationInstallation:async()=>({binding:{},confirm(){},release(){}}),
   openLocalFirstStore:async()=>({readApplication:async()=>({rows}),close(){}}),createApplicationCommitter:()=>({}),installOfflineEmulatorApplicationAuthority:async()=>authority,
   createApplicationBackgroundSync(options){const instance={closed:false,close(){this.closed=true;return instances.indexOf(this)===0?closing:Promise.resolve();},attach(){assert.equal(this.closed,false);return options.barrier(()=>({attached:true}));},status:()=>({state:'confirmed',cloudConfirmed:true})};instances.push(instance);return instance;},
   installApplicationWriteBoundary:()=>{binds++;return {run(){},busy:()=>false,close(){}};},createApplicationActionBinding:()=>({})};
  const w={FC:{session:{active:false},globalDataContract:{schemas:{},capture:()=>({model:{}}),validateBundle(){}},applicationSyncActions:{install(){}}},__FC_MAIN_ACCESS__:{assert(){}},navigator:{onLine:false},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const run=new Function('deps','with(deps){'+runtimeSource+';return startApplicationRuntime;}')(deps),runtime=await run({window:w,ownerUid:'synthetic-owner',localOnly:true,backgroundSync:true,boot:{localOnly:true,restored:true,rows:()=>rows,verifyFence(){fences++;if(peer)deps.fail('LF_OTHER_APPLICATION_CLIENT');}}});
  assert.equal(runtime.status().cloudConfirmed,true);runtime.close();assert.equal(runtime.status().cloudConfirmed,false);assert.equal(runtime.status().backgroundSync.cloudConfirmed,false);await assert.rejects(runtime.resume({localOwnerUid:'foreign-owner'}),e=>e.code==='LF_LOCAL_SYNC_NOT_AUTHORIZED');
  let resumed=false;const pending=runtime.resume({localOwnerUid:'synthetic-owner'}).then(()=>{resumed=true;});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(resumed,false,'A new admission waits for the old transport to close');assert.equal(instances.length,1);finish();await pending;
  assert.equal(instances.length,2);assert.equal(binds,2);assert.equal(listeners.size,3);assert.equal((await runtime.attachSync({})).attached,true);assert.equal(fences,1);peer=true;await assert.rejects(runtime.attachSync({}),e=>e.code==='LF_OTHER_APPLICATION_CLIENT');runtime.close();assert.equal(listeners.size,0);
 }
 console.log('PASS same-owner readmission waits for old background close and rebinds one controller/listeners; foreign owner still refuses');
 const {source}=require('./code-global-catalogs-asset');assert.equal(fs.readFileSync('sync/code-global-catalogs.generated.mjs','utf8'),source());
 const executor=fs.readFileSync('tools/helpers/synthetic-global-rebuild.mjs','utf8');assert.ok(executor.includes('w!==globalThis.window'));assert.ok(executor.includes('meble-lf-test-rebuild-'));assert.ok(executor.includes('SYNTHETIC_REBUILD_ONLY'));
 for(const file of ['index.html','tools/index-load-groups.js','js/app/cloud/application-bootstrap.js','sync/local-first-recovery-ui.mjs'])assert.equal(fs.readFileSync(file,'utf8').includes('synthetic-global-rebuild'),false);
 console.log('PASS browser code artifact matches generator; synthetic executor is excluded from product imports/manifest and refuses real origin/database');
 const ci=require('./ci-smoke-shards'),all=ci.plan(ci.inventory('tools',require('./cloud-ci-context').historicalSmoke)).flat();for(const name of ['android-globals-recovery-smoke.js','android-globals-recovery-browser-smoke.js','synthetic-global-rebuild-browser-smoke.js','main-login-smoke.js','trusted-main-login-smoke.js','local-first-rescue-smoke.js','local-first-rescue-browser-smoke.js','code-global-catalogs-smoke.js','code-global-rebuild-plan-smoke.js'])assert.equal(all.filter(n=>n===name).length,1,name);
 console.log('ANDROID GLOBALS RECOVERY: 7/7 groups PASS, all new and existing boundary tests in mandatory CI');
})().catch(error=>{console.error(error.code||error.message||'RECOVERY_TEST_FAILED');process.exitCode=1;});
