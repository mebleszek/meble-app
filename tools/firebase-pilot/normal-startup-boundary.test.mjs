import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {installApplicationWriteBoundary} from '../../sync/application-write-boundary.mjs';
import {reconcileGlobalAliases} from '../../sync/application-authority.mjs';
import {applicationInstallation} from '../../sync/application-installation.mjs';
import {prepareEmulatorApplicationBoot} from '../../sync/application-boot.mjs';
import {assertApplicationConnection,authorizeApplicationFirebase} from '../../sync/firebase-activation.mjs';
import {createApplicationReplication} from '../../sync/application-replication.mjs';
import {createProjectChannel} from '../../sync/local-first-project.mjs';
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
 await assert.rejects(w.FC.applicationWrite.globals(()=>true),/APPLICATION_BUSY/);assert.equal(calls,0);
 editorReady();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(settled,false);
 commitReady();assert.equal(await first,true);assert.equal(settled,true);bound.close();assert.equal(w.FC.applicationWrite,undefined);
});
test('central registry preserves promise completion only for installed lifecycle; ordinary actions retain boolean contract',async()=>{
 const w={FC:{}};vm.runInNewContext(read('js/core/actions.js'),{window:w});let calls=0;
 w.FC.actions.register({test:()=>{calls++;return true;}});assert.equal(w.FC.actions.dispatch('test'),true);
 w.FC.applicationLifecycle={dispatch:async(action,fn)=>{assert.equal(action,'test');await Promise.resolve();return fn();}};
 const p=w.FC.actions.dispatch('test');assert.equal(typeof p.then,'function');assert.equal(await p,true);assert.equal(calls,2);
});
test('mandatory CI includes the normal browser SDK suite, no removed old suites/pins or replacement of LOCAL-FIRST',()=>{
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
 const sync=createApplicationReplication({store,channels:[channel],eventTarget:new EventTarget(),online:()=>online,
  incoming(){throw Error('no incoming value');},refresh(){},assertIdle(){},
  discovery:{watch(notify){notify();return()=>{};},async list(){lists++;return[];}}});
 try{assert.equal(lists,0);online=true;sync.notify();await new Promise(r=>setImmediate(r));assert.equal(lists,1);}
 finally{sync.close();}
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
