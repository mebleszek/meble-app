'use strict';
// Only the observation boundary is exercised here; no SDK, network or persistent test data.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {world}=require('./trusted-main-login-smoke');
const {fixture}=require('./project-navigation-blockers-smoke');
const collect=require('../js/app/ui/session-diagnostics-readonly');
const read=p=>fs.readFileSync(p,'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const tests=[],test=(name,run)=>tests.push({name,run});
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setImmediate(r));}assert.fail('Diagnostic condition not reached');}
function bootstrap(w,modules={}){
 w.FC||={};w.location||={hostname:'localhost'};w.document||={baseURI:'http://localhost/'};
 w.addEventListener||=()=>{};w.document.addEventListener||=()=>{};
 const imports=[];
 // Replace ESM loading only, preserving the real bootstrap and all error handlers.
 const source=read('js/app/cloud/application-bootstrap.js').replace(/\bimport\(/g,'loadModule(');
 new Function('window','document','localStorage','location','loadModule',source)(w,w.document,w.localStorage,w.location,async path=>{
  imports.push(path);if(!(path in modules))throw Error('Unexpected module: '+path);return modules[path];
 });
 return {api:w.FC.applicationStartup,imports};
}
function normalStart(startApplicationRuntime){
 const w={navigator:{onLine:true},localStorage:{getItem:()=>null}};
 const f=bootstrap(w,{'./global-data-contract.js':{},'./cloud-pilot-contract.js':{},'./firebase-global-transport.js':{},
  '../../../sync/application-boot.mjs':{prepareApplicationBoot:async()=>({})},
  '../../../sync/application-runtime.mjs':{startApplicationRuntime}});
 f.api.configureEmulator({name:'meble-lf-test-diagnostic',connections:async()=>({})});return f;
}
test('first transfer failure survives runtime disposal, later errors, reload requirement and returned-snapshot mutation',async()=>{
 let starts=0;
 const {api}=normalStart(async({onStage,onDiagnostic})=>{
  starts++;onStage('initial-project-revisions');
  onDiagnostic({ok:false,code:'LF_PROJECT_OWNERSHIP_PENDING',projectTransferBlocked:true});
  for(let i=0;i<20;i++)onDiagnostic({ok:true});
  onStage('reconnect-runtime');throw Object.assign(Error('PRIVATE_MESSAGE'),{code:'LF_PROJECT_DEPENDENCY_MISSING'});
 });
 await api.beforeBusiness({ownerUid:'PRIVATE_UID'});
 await assert.rejects(api.start({ownerUid:'PRIVATE_UID'}),/PRIVATE_MESSAGE/);
 api.recordFailure({code:'AUTH_RELOAD_REQUIRED'},'login-startup');
 let d=api.diagnostics();assert.deepEqual(d.firstError,{stage:'initial-project-revisions',code:'LF_PROJECT_OWNERSHIP_PENDING'});
 assert.deepEqual(d.projectTransferBlocked,d.firstError);assert.equal(d.transferStatus,'blocked');
 assert.equal(d.code,'LF_PROJECT_DEPENDENCY_MISSING');assert.equal(starts,1,'Observation must not retry startup or a WRITE');
 d.firstError.code='PRIVATE_MUTATION';assert.equal(api.diagnostics().firstError.code,'LF_PROJECT_OWNERSHIP_PENDING');
 assert.equal(JSON.stringify(api.diagnostics()).includes('PRIVATE'),false);
});
test('expected offline scheduler wake is not a first failure; successful empty cycle is not a claimed project upload',async()=>{
 const {api}=normalStart(async({onStage,onDiagnostic})=>{
  onStage('initial-global-revision');onDiagnostic({ok:false,code:'LF_OFFLINE'});
  onStage('initial-project-revisions');onDiagnostic({ok:true});return {status:()=>({state:'active'})};
 });
 await api.beforeBusiness({ownerUid:'PRIVATE_UID'});await api.start({ownerUid:'PRIVATE_UID'});
 const d=api.diagnostics();assert.equal(d.firstError,null);assert.equal(d.projectTransferBlocked,null);
 assert.equal(d.transferStatus,'cycle-confirmed');assert.equal(d.stage,'ready');
 assert.equal('projectCount' in d,false);assert.equal('uploaded' in d,false);
});
test('only a closed vocabulary leaves the diagnostic, including SDK error codes but no exception payloads',()=>{
 const privateText='LF_PRIVATE_UID_TOKEN_PRICE_DOCUMENT',w={};const {api}=bootstrap(w);
 api.recordFailure({code:privateText,message:privateText,stack:privateText,uid:privateText,projectId:privateText},privateText);
 assert.deepEqual(api.diagnostics().firstError,{stage:'unknown',code:'UNRECOGNIZED_ERROR'});
 assert.equal(JSON.stringify(api.diagnostics()).includes(privateText),false);
 for(const code of ['permission-denied','unavailable','LF_PROJECT_SCHEMA_BLOCKED','CLOUD_PERMISSION_DENIED','GLOBAL_SOURCE_UNCONFIRMED'])assert.equal(api.errorCode(code),code);
 assert.equal(api.errorCode({get code(){throw Error(privateText);}}),'UNRECOGNIZED_ERROR');
 const fresh=bootstrap({}).api;fresh.recordFailure({code:'AUTH_RELOAD_REQUIRED'},'login-startup');assert.equal(fresh.diagnostics().firstError,null);
});
test('real main-login keeps fatal refusal and shows first stage/code on the second Google login without re-running startup',async()=>{
 let calls=0;let api;
 const d=world({},null,{beforeMain(w){
  api=bootstrap(w).api;
  // A fault at the real source-preparation boundary; no change to Auth/fatal logic.
  api.beforeBusiness=async()=>{calls++;throw Object.assign(Error('PRIVATE_ERROR'),{code:'LF_INITIAL_GLOBAL_CONFLICT'});};
 }});
 try{
  const rows=[...d.shared.rows];d.w.projectData={unsaved:'PRIVATE_RAM'};
  await until(()=>d.nodes['auth-google']?.disabled===false);
  d.input('click','auth-google');await until(()=>d.nodes['auth-error']?.textContent?.includes('LF_INITIAL_GLOBAL_CONFLICT'));
  assert.equal(d.ready(),false);assert.equal(calls,1);
  d.input('click','auth-google');await until(()=>d.nodes['auth-error']?.textContent?.includes('AUTH_RELOAD_REQUIRED'));
  assert.match(d.nodes['auth-error'].textContent,/Pierwszy błąd: preparing-source \/ LF_INITIAL_GLOBAL_CONFLICT/);
  assert.equal(calls,1,'fatal must still refuse a new business startup');assert.equal(d.ready(),false);
  assert.deepEqual(d.w.projectData,{unsaved:'PRIVATE_RAM'});
  assert.equal(d.shared.rows.get('fc_projects_v1'),new Map(rows).get('fc_projects_v1'));
  assert.equal(d.nodes['auth-error'].textContent.includes('PRIVATE'),false);
 }finally{d.close();}
});
test('existing session collector and copy/format UI expose safe transfer metadata without writing or weakening access',async()=>{
 const r=fixture(undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});assert.equal(await r.open(),true);
 const w=r.s;w.location={hostname:'localhost',origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html'};
 let valid=true;Object.defineProperty(w,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>valid}),writable:false,configurable:false});
 const {api}=normalStart(async({onStage,onDiagnostic})=>{
  onStage('initial-project-revisions');onDiagnostic({ok:false,code:'LF_PROJECT_SCHEMA_BLOCKED',projectTransferBlocked:true});
  return {status:()=>({state:'active'})};
 });
 await api.beforeBusiness({ownerUid:'PRIVATE_UID'});await api.start({ownerUid:'PRIVATE_UID'});w.FC.applicationStartup=api;
 const before=r.seed(),ram=JSON.stringify(r.FC.session),writes=[];
 for(const key of ['setItem','removeItem','clear'])r.storage[key]=()=>{writes.push(key);throw Error('Forbidden write');};
 w.fetch=()=>{throw Error('Forbidden network');};w.indexedDB={open(){throw Error('Forbidden IDB open');}};
 const out=collect(w);assert.equal(out.status,'READ_ONLY');assert.deepEqual(out.localFirst,api.diagnostics());
 assert.deepEqual(Object.keys(out.localFirst).sort(),['code','firstError','projectTransferBlocked','stage','status','transferStatus']);
 let modal,copied;w.FC.infoBox={open:options=>{modal=options;}};
 new Function('window','navigator',read('js/app/ui/session-diagnostics.js'))(w,{clipboard:{writeText:async text=>{copied=text;}}});
 w.FC.sessionDiagnostics.open();assert.match(modal.message,/LOCAL-FIRST:/);
 assert.match(modal.message,/project-transfer-blocked: initial-project-revisions \/ LF_PROJECT_SCHEMA_BLOCKED/);
 await modal.secondaryAction.run({button:{},body:{}});assert.deepEqual(JSON.parse(copied).localFirst,clone(api.diagnostics()));
 assert.deepEqual(r.seed(),before);assert.equal(JSON.stringify(r.FC.session),ram);assert.deepEqual(writes,[]);
 const diagnostic=api.diagnostics;api.diagnostics=()=>{throw Error('PRIVATE_DIAGNOSTIC_FAILURE');};
 assert.deepEqual(collect(w).localFirst,{status:'UNAVAILABLE'});w.FC.sessionDiagnostics.open();assert.match(modal.message,/LOCAL-FIRST: UNAVAILABLE/);
 api.diagnostics=diagnostic;
 valid=false;assert.deepEqual(collect(w),{v:1,status:'AUTH_DENIED'});
});
test('real runtime emits raw refusal code only for observation; same writes, reads, return and cleanup with throwing observer',async()=>{
 const source=read('sync/application-runtime.mjs').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 async function run(observer){
  const trace=[],rows={fc_projects_v1:JSON.stringify([{id:'private-project',investorId:'private-investor'}])};
  const store={deviceId:'private-device',readApplication:async()=>({rows}),snapshot:async scope=>{trace.push('read:'+scope);return scope==='globals'?{replica:{base:{},dirty:false}}:{};},exclusive:fn=>fn(),close(){trace.push('store-close');}};
  const sync={channel:()=>({}),flush:async()=>{trace.push('flush');return {ok:true};},notify(){trace.push('notify');},close(){trace.push('sync-close');}};
  const authority={rows:()=>rows,assertIdle(){},status:()=>({}),close(){trace.push('authority-close');}};
  const globals={},deps={completeMissingApplicationGlobals(){assert.fail('Unexpected catalog write');},emptyInstallationRows:x=>x,
   openLocalFirstStore:async()=>store,createGlobalChannel:()=>globals,createProjectChannel:()=>({}),createApplicationReplication:()=>sync,
   createEmulatorProjectDiscovery:()=>({}),createApplicationCommitter:()=>({}),projectApplicationRows(){assert.fail('Unexpected apply');},
   installEmulatorApplicationAuthority:async()=>authority,installOfflineEmulatorApplicationAuthority:async()=>authority,installAuthorizedApplicationAuthority:async()=>authority,
   createApplicationActionBinding:()=>({}),applicationKeys:()=>[],installApplicationWriteBoundary:()=>({busy:()=>false}),
   applicationInstallation:async()=>({binding:{},rows,confirm(){trace.push('confirm');},release(){trace.push('release');}}),
   verifyExclusiveClient(){},assertApplicationConnection:()=>({uid:'private-owner'}),copy:structuredClone,equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
   assertEmulator(){},fail:code=>{throw Object.assign(Error(code),{code});},safeError:()=>({ok:false,code:'LF_REMOTE_UNCONFIRMED'})};
  const start=new Function(...Object.keys(deps),source+'\nreturn startApplicationRuntime;')(...Object.values(deps));
  const w={FC:{session:{active:true},globalDataContract:{},businessProjectContract:{build:async()=>{trace.push('build');throw Object.assign(Error('PRIVATE_EXCEPTION'),{code:'permission-denied',uid:'private-owner'});}},applicationSyncActions:{install(){trace.push('bind');}}},
   __FC_MAIN_ACCESS__:{assert(){}},navigator:{onLine:true},addEventListener(){},localStorage:{getItem:()=>null}};
  const result=await start({window:w,writer:{db:{app:{}}},reader:{db:{app:{}}},ownerUid:'private-owner',onDiagnostic:observer});
  return {trace,status:result.status()};
 }
 const events=[],plain=await run(),observed=await run(value=>events.push(clone(value))),throwing=await run(()=>{throw Error('Observer failure');});
 assert.deepEqual(observed,plain);assert.deepEqual(throwing,plain);
 const blocked=events.find(x=>x.projectTransferBlocked);assert.deepEqual(blocked,{ok:false,code:'permission-denied',projectTransferBlocked:true});
 assert.equal(JSON.stringify(events).includes('PRIVATE'),false);assert.equal(JSON.stringify(events).includes('private-owner'),false);
 assert.equal(plain.status.states.find(x=>x.scope==='project-transfer-blocked').code,'LF_REMOTE_UNCONFIRMED','Existing synchronizer state/decisions remain unchanged');
});
test('new smoke belongs to exactly one mandatory current CI shard and every changed public script is versioned',()=>{
 const plan=require('./ci-smoke-shards'),historical=require('./cloud-ci-context').historicalSmoke;
 assert.equal(plan.plan(plan.inventory('tools',historical)).flat().filter(x=>x==='first-sync-error-diagnostics-smoke.js').length,1);
 assert.match(read('.github/workflows/preflight-js.yml'),/node tools\/preflight\.js --current-only --smoke-shard=/);
 require('./script-versions').assertVersions(process.cwd());
 for(const file of ['js/main-login.js','js/app/cloud/application-bootstrap.js'])assert.ok(read('index.html').includes(file+'?v=20261102_first_sync_error_v1'));
});
(async()=>{for(const {name,run}of tests){await run();console.log('PASS '+name);}console.log(`First-sync diagnostics: ${tests.length}/${tests.length} PASS`);})().catch(error=>{console.error(error.stack);process.exitCode=1;});
