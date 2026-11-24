import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {installApplicationWriteBoundary} from '../../sync/application-write-boundary.mjs';
import {confirmedApplicationDraft,reconcileGlobalAliases} from '../../sync/application-authority.mjs';
import {applicationInstallation} from '../../sync/application-installation.mjs';
import {prepareEmulatorApplicationBoot} from '../../sync/application-boot.mjs';
import {assertApplicationConnection,authorizeApplicationFirebase} from '../../sync/firebase-activation.mjs';
import {createApplicationReplication,createApplicationHandover} from '../../sync/application-replication.mjs';
import {createProjectChannel} from '../../sync/local-first-project.mjs';
import {startupReady,replicationWaiting} from './normal-startup-readiness.mjs';
const root=new URL('../..',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
test('normal startup remains inert on public origin, flags cannot activate connections/migration',async()=>{
 let calls=0;const request=mock.method(globalThis,'fetch',()=>{calls++;throw Error('remote IO');});
 try{
  const ls={getItem:()=>null},w={FC:{},addEventListener(){}};
  vm.runInNewContext(read('js/app/cloud/application-bootstrap.js'),{window:w,location:{hostname:'mebleszek.github.io'},localStorage:ls,navigator:{},document:{addEventListener(){}}});
  assert.throws(()=>w.FC.applicationStartup.configureEmulator({name:'meble-lf-test-forged',connections:()=>{calls++;}}),/PRODUCTION_ACTIVATION_REQUIRED/);
  assert.equal((await w.FC.applicationStartup.start({ownerUid:'owner',approved:true,live:true})).status,'LIVE_BLOCKED');
  ls.getItem=()=>'{"version":1}';await assert.rejects(w.FC.applicationStartup.beforeBusiness({ownerUid:'owner'}),/RUNTIME_REQUIRED/);
  await assert.rejects(applicationInstallation({window:{location:{hostname:'mebleszek.github.io'}},ownerUid:'owner',name:'meble-local-first-v1'}),/PRODUCTION_MIGRATION_NOT_APPROVED/);
  await assert.rejects(prepareEmulatorApplicationBoot({window:{location:{hostname:'mebleszek.github.io'}},ownerUid:'owner',name:'meble-local-first-v1'}),/PRODUCTION_MIGRATION_NOT_APPROVED/);
  await assert.rejects(authorizeApplicationFirebase({decision:{approved:true},store:{readApplication(){calls++;throw Error('unapproved read');}}}),/CUTOVER_NOT_PROVEN/);
  const connection={db:{app:{options:{projectId:'mebleszek-meble-app'}}}};
  assert.throws(()=>assertApplicationConnection(connection),/APPLICATION_ACTIVATION_REQUIRED/);
  assert.throws(()=>createProjectChannel({writer:connection,reader:connection,ownerUid:'owner',deviceId:'device',projectId:'project',investorId:'investor'}),/APPLICATION_ACTIVATION_REQUIRED/);
  assert.equal(calls,0);
 }finally{request.mock.restore();}
});
test('application write boundary reserves one operation before asynchronous editor acquisition and awaits durability',async()=>{
 let editorReady,commitReady,calls=0,settled=false;
 const editor=new Promise(resolve=>{editorReady=resolve;}),commit=new Promise(resolve=>{commitReady=resolve;});
 const w={FC:{infoBox:{open(){}}},localStorage:{getItem:()=> 'project'}};
 const authority={async transaction(kind,fn){calls++;const value=await fn();await commit;return value;}};
 const bound=installApplicationWriteBoundary({window:w,authority,ensureEditor:()=>editor});
 const first=w.FC.applicationWrite.project(()=>true).then(v=>{settled=true;return v;});
 let idle=false;const waiting=w.FC.applicationWrite.whenIdle().then(()=>{idle=true;});
 await assert.rejects(w.FC.applicationWrite.globals(()=>true),/APPLICATION_BUSY/);assert.equal(calls,0);
 editorReady();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(settled,false);assert.equal(idle,false);
 commitReady();assert.equal(await first,true);await waiting;assert.equal(idle,true);assert.equal(settled,true);bound.close();assert.equal(w.FC.applicationWrite,undefined);
});
test('write completion releases waiters after an abort without running success callbacks',async()=>{
 let release,called=0;const gate=new Promise(resolve=>release=resolve),w={FC:{}};
 const bound=installApplicationWriteBoundary({window:w,authority:{async transaction(){await gate;throw Error('LF_IDB_ABORTED');}},ensureEditor:async()=>{}});
 const save=w.FC.applicationWrite.project(()=>true);w.FC.applicationWrite.afterCommit(()=>called++);
 const wait=w.FC.applicationWrite.whenIdle();release();await assert.rejects(save,/LF_IDB_ABORTED/);await wait;
 assert.equal(called,0);assert.equal(bound.busy(),false);bound.close();
});
test('quote generation prepares missing local defaults through the scoped durable settings writer',async()=>{
 for(const mode of ['missing','existing','abort','changed-owner']){
  const rows=new Map(),scope={projectId:'room',investorId:'investor'};let calls=0;
  const w={FC:{storage:{getRaw:key=>rows.get(key)??null,getJSON:(key,fallback)=>rows.has(key)?JSON.parse(rows.get(key)):fallback,setJSON(key,value){rows.set(key,JSON.stringify(value));return true;}},projectStore:{getCurrentProjectId:()=>scope.projectId},investors:{getCurrentId:()=>scope.investorId}}};
  vm.runInNewContext(read('js/app/quote/quote-offer-store.js'),{window:w,Date,JSON});
  const api=w.FC.quoteOfferStore;
  const foreign={projectId:'other',investorId:'other-owner',unknown:{preserve:true}};
  const existing=api.normalizeDraft({commercial:{customerNote:'Retain existing terms'}},scope);
  rows.set(api.DRAFT_KEY,JSON.stringify(mode==='existing'?[foreign,existing]:[foreign]));const before=rows.get(api.DRAFT_KEY);
  w.FC.applicationWrite={registry:'p0b-rooms-v1',offerDraft:async fn=>{calls++;if(mode==='abort')throw Error('LF_IDB_ABORTED');if(mode==='changed-owner')scope.projectId='other';return fn();}};
  if(mode==='abort')await assert.rejects(api.prepareGeneration(),/LF_IDB_ABORTED/);
  else assert.equal(!!await api.prepareGeneration(),mode!=='changed-owner');
  if(mode==='missing'){
   const saved=JSON.parse(rows.get(api.DRAFT_KEY));assert.equal(saved.length,2);assert.deepEqual(saved.find(row=>row.projectId==='other'),foreign);
   assert.equal(saved.find(row=>row.projectId==='room').commercial.discountAmount,0);assert.equal(calls,1);
   assert.equal(!!await api.prepareGeneration(),true);assert.equal(calls,1,'Existing settings are never rewritten by generation');
  }else assert.equal(rows.get(api.DRAFT_KEY),before);
 }
});
test('central registry preserves promise completion only for installed lifecycle; ordinary actions retain boolean contract',async()=>{
 const w={FC:{}};vm.runInNewContext(read('js/core/actions.js'),{window:w});let calls=0;
 w.FC.actions.register({test:()=>{calls++;return true;}});assert.equal(w.FC.actions.dispatch('test'),true);
 w.FC.applicationLifecycle={dispatch:async(action,fn)=>{assert.equal(action,'test');await Promise.resolve();return fn();}};
 const p=w.FC.actions.dispatch('test');assert.equal(typeof p.then,'function');assert.equal(await p,true);assert.equal(calls,2);
});
test('mandatory CI includes the normal browser SDK suite, no removed old suites/pins or replacement of LOCAL-FIRST',async()=>{
 let clock=0;const w={FC:{applicationStartup:{inspect:()=>({stage:'initial-global-revision'})}}},document={body:{dataset:{}}};
 const probe=vm.runInNewContext('('+startupReady.toString()+')',{window:w,document,performance:{now:()=>clock}});
 assert.equal(probe({idleMs:30000}),false);
 clock=29000;w.normalDataRpcProgress=1;assert.equal(probe({idleMs:30000}),false);
 clock=58000;w.normalDataRpcProgress=2;assert.equal(probe({idleMs:30000}),false,'Completed data RPCs prove real progress beyond the old total deadline');
 clock=88000;w.normalRpcTimeline=[{collections:['syncAccess'],ms:1}];
 assert.throws(()=>probe({idleMs:30000}),/NORMAL_STARTUP_NO_PROGRESS/,'Periodic permission checks must not hide a stalled data operation');
 document.body.dataset.businessState='ready';assert.equal(probe({idleMs:30000}),true);
 delete document.body.dataset.businessState;document.body.dataset.authState='error';assert.equal(probe({idleMs:30000}),true,'Explicit refusal is surfaced, never treated as a successful app start');
 assert.throws(()=>probe({idleMs:30000,stopOnAuthState:false}),/NORMAL_STARTUP_REFUSED/);
 document.body.dataset.authState='profile-pending';w.normalStartupWait=null;
 assert.equal(probe({idleMs:30000,stopOnAuthState:false}),false,'After admission, only actual business readiness completes login');
 const wait={startedAt:0,lastProgressAt:0,signature:'[0,0]'};
 assert.equal(replicationWaiting(wait,4999,'[0,0]'),true);
 assert.equal(replicationWaiting(wait,5000,'[0,0]'),false,'Auth-only activity or a pending request cannot extend replication');
 assert.equal(replicationWaiting(wait,6000,'[1,0]'),true,'A completed data RPC earns bounded transfer time');
 assert.equal(replicationWaiting(wait,11000,'[1,0]'),false,'A stalled transfer loses the allowance after5 s');
 assert.equal(replicationWaiting(wait,29999,'[2,0]'),true);
 assert.equal(replicationWaiting(wait,30000,'[3,0]'),false,'Even continuing RPC progress cannot remove the30 s hard allowance bound');
 const {confirmQuoteSources,applicationIdle}=await import('./quote-ui-actions.mjs');
 let applicationState={transactionPending:false,incomingPending:true};
 const idle=vm.runInNewContext('('+applicationIdle.toString()+')',{window:{FC:{applicationStartup:{inspect:()=>applicationState}}}});
 assert.equal(idle(),false,'An incoming offer still owns the image even without a local transaction');
 applicationState={transactionPending:true,incomingPending:false};assert.equal(idle(),false);
 applicationState={transactionPending:false};assert.equal(idle(),false,'Missing incoming state is not confirmed idle');
 applicationState={transactionPending:false,incomingPending:false};assert.equal(idle(),true);
 let sourceBusy=false,warning=null,notice=null,clicked=0;
 const button={disabled:true},generation={inFlight:false},visible={getClientRects:()=>[{}]},hidden={getClientRects:()=>[]};
 const quoteWindow={FC:{wycenaTabShell:{_generateRuntime:generation},roomQuoteAccess:{busy:()=>sourceBusy}}};
 const quoteDocument={querySelector:selector=>selector==='.quote-lock-warning'?warning:selector==='.info-box'?notice:button};
 await confirmQuoteSources({
  async waitForFunction(fn){
   const ready=vm.runInNewContext('('+fn.toString()+')',{window:quoteWindow,document:quoteDocument});
   assert.equal(!!ready(),false,'A disabled gesture is still pending before quote access begins');
   sourceBusy=true;assert.equal(!!ready(),false,'Source inspection is not completed generation');
   warning=hidden;notice=hidden;assert.equal(!!ready(),false,'Hidden old panels cannot complete the wait');
   warning=visible;assert.equal(!!ready(),true,'A late source warning must receive the explicit answer');
   warning=null;generation.inFlight=true;assert.equal(!!ready(),true,'Math starts only after source confirmation');
   generation.inFlight=false;sourceBusy=false;assert.equal(!!ready(),false,'Pending settings still own the disabled gesture');
   button.disabled=false;assert.equal(!!ready(),true,'A quick completed operation cannot leave the helper waiting');
   button.disabled=true;sourceBusy=true;notice=visible;assert.equal(!!ready(),true,'A real refusal is surfaced to the caller');
   notice=null;warning=visible;
  },
  locator:()=>({isVisible:async()=>warning===visible,getByRole(role,options){assert.equal(role,'button');assert.deepEqual(options,{name:'Tak',exact:true});return {click:async()=>{clicked++;}};}})
 });
 assert.equal(clicked,1,'The helper answers the real source warning exactly once');
 const ctx=read('tools/cloud-ci-context.js'),suite=read('tools/firebase-pilot/cloud-sync-global.test.mjs');
 assert.ok(ctx.includes('cloud-sync-global.test.mjs'));assert.ok(suite.includes('await runNormalApplication(t)'));
 assert.ok(suite.includes('await runApplicationE2E(t)'));assert.ok(suite.includes('await runLocalFirstSuite(t)'));
 const shell=read('index.html'),login=read('js/main-login.js');
 assert.ok(shell.indexOf('application-bootstrap.js')<shell.indexOf('js/main-login.js'));
 assert.ok(login.indexOf('applicationStartup?.beforeBusiness')<login.indexOf('loader.start(manifest)'));
 const runtime=read('sync/application-runtime.mjs');for(const part of ['createApplicationReplication','createGlobalChannel','createProjectChannel','businessProjectContract'])assert.ok(runtime.includes(part));
 assert.ok(read('sync/application-boot.mjs').includes('LF_LEGACY_BOOT_WRITE_REFUSED'));
 assert.ok(read('sync/application-installation.mjs').includes('LF_INSTALLATION_RECEIPT_LOST'));
 assert.equal(read('offline-worker.js').includes('skipWaiting('),false);assert.equal(read('offline-worker.js').includes('clients.claim('),false);
});


test('project discovery wakes after startup even if its only initial server notification arrived while offline',async()=>{
 let online=false,lists=0;
 const channel={scope:'globals',kind:'globals',watch(){return()=>{};},async read(){throw Object.assign(Error(),{code:'GLOBAL_NOT_FOUND'});}};
 const store={exclusive:async fn=>fn(),snapshot:async()=>({replica:null,operations:[]})};
 const events=new EventTarget();
 const sync=createApplicationReplication({store,channels:[channel],eventTarget:events,online:()=>online,
  incoming(){throw Error('no incoming value');},refresh(){},assertIdle(){},
  discovery:{watch(notify){notify();return()=>{};},async list(){lists++;return[];}}});
 try{
  assert.equal(lists,0);online=true;sync.notify('globals');
  await new Promise(r=>setImmediate(r));assert.equal(lists,0);
  events.dispatchEvent(new Event('online'));
  await new Promise(r=>setImmediate(r));assert.equal(lists,1);
 }
 finally{await sync.close();}
});

test('navigation stays reserved until confirmed handover, not merely the local IDB checkpoint',async()=>{
 let finish;const completion=new Promise(resolve=>{finish=resolve;});let calls=0;
 const w={FC:{infoBox:{open(){}}},localStorage:{getItem:()=> 'project'}};
 const boundary=installApplicationWriteBoundary({window:w,authority:{transaction:async(_kind,fn)=>fn()},ensureEditor:async()=>{},onExit:()=>completion});
 const nav=w.FC.applicationLifecycle.dispatch('open-investors-list',()=>true);
 await new Promise(r=>setImmediate(r));assert.equal(boundary.busy(),true);
 assert.equal(await w.FC.applicationLifecycle.dispatch('open-investor',()=>{calls++;return true;}),false);assert.equal(calls,0);
 finish();assert.equal(await nav,true);assert.equal(boundary.busy(),false);boundary.close();
});

test('explicit Exit releases a confirmed project without waiting on unrelated sync',async()=>{
 const request={key:'handover:project',deviceId:'pc',epoch:1};
 let saved=null,releases=0,scheduled=0;
 const store={
  pendingHandover:async()=>saved,
  snapshot:async()=>({replica:{base:{generation:1},dirty:false,editor:{deviceId:'pc',epoch:1}},operations:[{phase:'verified'}]})
 };
 const handover=createApplicationHandover({store,online:()=>true,onError:assert.fail,getSync:()=>({
  notify(){scheduled++;},
  flush(){assert.fail('The project already has ACK');},
  async releaseRequestedEditor(scope,expected){
   assert.equal(scope,'project');assert.deepEqual(expected,request);releases++;
  }
 })});
 await handover.resume(['project']);
 assert.equal(releases,0,'A restart without an explicit Exit retains the editor');
 saved=request;
 await handover.start('project');
 assert.equal(releases,1);
 assert.equal(scheduled,0);
});

test('explicit global edits preserve declared aliases without repairing divergent historical RAW',()=>{
 const contract={sources:{labor:['primary','legacy']}},before={primary:'[{"id":"stable","price":7.125}]',legacy:'[{"id":"stable","price":7.125}]',protected:'RAW'};
 const after={...before,primary:'[{"id":"stable","price":21.375}]'},next=reconcileGlobalAliases(before,after,contract);
 assert.equal(next.primary,next.legacy);assert.equal(next.primary,after.primary);assert.equal(before.legacy,'[{"id":"stable","price":7.125}]');assert.equal(next.protected,'RAW');
 assert.throws(()=>reconcileGlobalAliases({...before,legacy:'[{"id":"foreign"}]'},after,contract),/LF_GLOBAL_ALIAS_CONFLICT/);
 assert.throws(()=>reconcileGlobalAliases(before,{...after,legacy:'[]'},contract),/LF_GLOBAL_ALIAS_CONFLICT/);
});

test('whole-store restore refuses before legacy callbacks or journals can mutate unrelated keys',()=>{
 let writes=0;const restore=()=>{writes++;};const w={FC:{dataBackupStore:{restoreBackup:restore,importSnapshot:restore},dataBackupSnapshot:{applySnapshot:restore},dataBackupSnapshotApply:{applySnapshot:restore}},localStorage:{getItem:()=>null}};
 const b=installApplicationWriteBoundary({window:w,authority:{},ensureEditor:async()=>{}});
 for(const [api,names]of [[w.FC.dataBackupStore,['restoreBackup','importSnapshot']],[w.FC.dataBackupSnapshot,['applySnapshot']],[w.FC.dataBackupSnapshotApply,['applySnapshot']]])for(const n of names)assert.throws(()=>api[n]({}),/LF_ARCHIVE_RESTORE_PROTOCOL_REQUIRED/);
 assert.equal(writes,0);b.close();
});


test('flush refuses unconfirmed project discovery and retries it only on a new observation',async()=>{
 let queries=0,reads=0,recovered=false;
 const events=new EventTarget(),states=[];
 const channel={scope:'globals',kind:'globals',watch:()=>()=>{},async read(){reads++;throw Object.assign(Error(),{code:'GLOBAL_NOT_FOUND'});}};
 const store={exclusive:async fn=>fn(),snapshot:async()=>({replica:null,operations:[]})};
 const sync=createApplicationReplication({store,channels:[channel],eventTarget:events,onState:state=>states.push(state),
  incoming(){throw Error('No unknown project may be applied');},refresh(){},assertIdle(){},
  discovery:{watch:()=>()=>{},async list(){queries++;if(!recovered)throw Object.assign(Error(),{code:'permission-denied'});return[];}}});
 try{
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(queries,1);
  const beforeFlush=reads;
  const refused=await sync.flush();
  assert.ok(reads>beforeFlush,'Known independent scopes must still be processed');
  assert.equal(refused.ok,false);
  assert.equal(refused.code,'LF_PROJECT_DISCOVERY_UNCONFIRMED');
  const afterFailure=queries;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(queries,afterFailure,'Failure must not cause a self-scheduling query retry');
  recovered=true;
  assert.equal((await sync.flush()).ok,true);
  assert.equal(queries,afterFailure+1);
  assert.equal((await sync.flush()).ok,true);
  assert.equal(queries,afterFailure+1,'Confirmed inventory uses its existing watcher, without polling on every flush');
  assert.ok(states.some(state=>state.code==='LF_PROJECT_DISCOVERY_UNCONFIRMED'));
 }finally{await sync.close();}
});

test('connection handoff drains the old read before a replacement publishes; stale lease never consumes the queued write',async()=>{
 let release,entered,stopped=false,writes=0,remote={head:{generation:1},value:{exact:1}},operation=null;
 const readEntered=new Promise(r=>entered=r),held=new Promise(r=>release=r),events=new EventTarget();
 const store={exclusive:async fn=>fn(),snapshot:async()=>({replica:{base:{generation:1},dirty:!!operation},operations:operation?[operation]:[]}),
  transition:async(_key,_phase,next,patch={})=>{operation={...operation,phase:next,...patch};return operation;}};
 const old=createApplicationReplication({store,channels:[{scope:'globals',kind:'globals',watch:()=>()=>{},async read(){entered();await held;throw Error('AUTH_ACCESS_REVOKED');}}],eventTarget:events,
  incoming(){throw Error('no old apply');},refresh(){},assertIdle(){}});
 await readEntered;
 operation={key:'one-offline-write',scope:'globals',phase:'queued',localVersion:1,base:{generation:1},json:JSON.stringify({exact:7.125})};
 const closing=Promise.resolve(old.close()).then(()=>{stopped=true;});
 await new Promise(r=>setImmediate(r));assert.equal(stopped,false,'close must not announce completion while its old SDK read holds the cycle');
 release();await closing;assert.equal(operation.phase,'queued');assert.equal(writes,0);
 const fresh=createApplicationReplication({store,channels:[{scope:'globals',kind:'globals',watch:()=>()=>{},read:async()=>remote,
  prepare:async()=>({expected:{generation:2},async publish(){writes++;remote={head:{generation:2},value:{exact:7.125}};}})}],eventTarget:events,
  incoming(){throw Error('no fresh apply');},refresh(){},assertIdle(){}});
 try{assert.equal((await fresh.flush()).ok,true);assert.equal(operation.phase,'verified');assert.equal(writes,1);assert.deepEqual(remote.value,{exact:7.125});}finally{await fresh.close();}
});

test('verified durable draft can expose recovery while incoming RAM protection remains fail-closed',()=>{
 const make=()=>{
  const rows={fc_projects_v1:'[{"id":"room"}]',fc_edit_session_v1:'verified-session',fc_current_project_id_v1:'room',fc_current_investor_v1:'investor'};
  const w={projectData:{exact:17.125},localStorage:{getItem:()=>rows.fc_edit_session_v1},document:{getElementById:()=>null},FC:{
   investorProjectRuntime:{hasProjectDivergence:()=>false},investorEditorState:{hasUiLock:()=>false},
   session:{active:true,durable:true,snapshot:{exact:1},projectId:'room',roomId:'room',context:{investorId:'investor'},inspectNavigationState:()=>({raws:{fc_projects_v1:rows.fc_projects_v1,fc_edit_session_v1:rows.fc_edit_session_v1}})}}};
  return {window:w,rows,image:{rows:structuredClone(rows)}};
 };
 const valid=make(),before=structuredClone(valid.rows);assert.equal(confirmedApplicationDraft(valid),true);assert.deepEqual(valid.rows,before);
 for(const mutate of [x=>x.busy=true,x=>x.incoming=true,x=>x.image.rows.fc_projects_v1='newer',x=>x.window.FC.session.active=false,x=>x.window.FC.session.durable=false,
  x=>x.window.FC.session.snapshot=null,x=>x.window.FC.session.roomId='',x=>x.window.FC.session.projectId='other',x=>x.window.FC.session.context.investorId='other',
  x=>x.window.FC.investorProjectRuntime.hasProjectDivergence=()=>true,x=>x.window.FC.investorEditorState.hasUiLock=()=>true,
  x=>x.window.FC.priceModal={isItemDirty:()=>true},x=>x.window.document.getElementById=()=>({style:{display:'block'}}),
  x=>x.window.FC.session.inspectNavigationState=()=>null,x=>x.window.FC.session.inspectNavigationState=()=>({raws:{}}),x=>x.window.FC.session.inspectNavigationState=()=>({raws:{fc_projects_v1:'unconfirmed'}}),
  x=>x.window.localStorage.getItem=()=> 'other-session',x=>x.rows.fc_edit_session_v1=null]){
   const input=make();mutate(input);assert.equal(confirmedApplicationDraft(input),false);
  }
});
