'use strict';
const assert=require('node:assert/strict');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({phase='queued',handover=false,online=true,batch={version:1,firstAt:1000000,lastAt:1000000},now=1000000,kind='project'}={}){
 const {createDurableSynchronizer}=await import('../sync/local-first-sync.mjs');
 let time=now,nextId=0,connected=online,published=0;const timers=new Map(),events=new EventTarget();
 const value={saved:2},head={generation:2},replica={version:2,json:JSON.stringify(value),hash:'hash',base:{generation:1},dirty:true};
 let remoteEditor={active:true,deviceId:'device',epoch:1},editorError=null;
 const op={editor:structuredClone(remoteEditor),key:'save',scope:'room',phase,json:replica.json,hash:replica.hash,localVersion:2,base:replica.base,blockers:[],batch,...(phase==='uncertain'?{expected:head}:{})};
 const store={exclusive:f=>f(),snapshot:async()=>structuredClone({replica,operations:[op]}),pendingHandover:async()=>handover?{epoch:1}:null,
  transition:async(key,from,to,patch)=>{assert.equal(key,op.key);assert.equal(op.phase,from);Object.assign(op,patch,{phase:to});if(to==='verified'){replica.base=patch.receipt;replica.dirty=false;}return structuredClone(op);}};
 const channel={scope:'room',kind,editor:async()=>{if(editorError)throw Object.assign(Error(editorError),{code:editorError});return structuredClone(remoteEditor);},prepare:async()=>({expected:head,publish:async()=>{published++;}}),read:async()=>({head,value}),readHead:async()=>head};
 const clock={now:()=>time,setTimeout(fn,ms){const id=++nextId;timers.set(id,{fn,due:time+ms});return id;},clearTimeout:id=>timers.delete(id)};
 const sync=createDurableSynchronizer({store,channels:[channel],eventTarget:events,online:()=>connected,clock});
 async function idle(){for(let i=0;i<4;i++)await settle();}
 async function advance(ms){time+=ms;for(const [id,t]of [...timers])if(t.due<=time){timers.delete(id);t.fn();}await idle();}
 await idle();
 return {sync,op,timers,advance,idle,takeover(editor={active:true,deviceId:'other',epoch:2}){remoteEditor=editor;},refuseEditor(code){editorError=code;},get published(){return published;},get dirty(){return replica.dirty;},get now(){return time;},
  online(){connected=true;events.dispatchEvent(new Event('online'));},wake(){events.dispatchEvent(new Event('pageshow'));}};
}
(async()=>{
 const {prepareProjectBatch,projectBatchDelay}=await import('../sync/local-first-project-batching.mjs');
 let x=await fixture();assert.equal(x.published,0);await x.advance(119999);assert.equal(x.published,0);await x.advance(1);assert.equal(x.published,1);assert.equal(x.op.phase,'verified');assert.equal(x.dirty,false);await x.sync.close();assert.equal(x.timers.size,0);
 x=await fixture();await x.advance(60000);x.op.batch.lastAt=x.now;x.sync.notify('room');await x.idle();await x.advance(119999);assert.equal(x.published,0);await x.advance(1);assert.equal(x.published,1);await x.sync.close();
 x=await fixture({batch:{version:1,firstAt:1000000,lastAt:1270000},now:1270000});await x.advance(29999);assert.equal(x.published,0);await x.advance(1);assert.equal(x.published,1);await x.sync.close();
 x=await fixture();x.takeover();x.sync.notify('room');await x.idle();
 assert.equal(x.published,0);assert.equal(x.op.phase,'conflict');assert.equal(x.op.code,'LF_EDITOR_CONFLICT');assert.equal(x.dirty,true);
 const stale=await x.sync.flush();assert.equal(stale.ok,false);assert.equal(stale.code,'LF_EDITOR_CONFLICT');assert.deepEqual(stale.blockedScopes,['room']);assert.equal(x.published,0);await x.sync.close();
 for(const editor of [null,{active:false,deviceId:'device',epoch:1},{active:true,deviceId:'device',epoch:2}]){
  x=await fixture();const saved=x.op.json;x.takeover(editor);x.sync.notify('room');await x.idle();assert.equal(x.op.phase,'conflict');assert.equal(x.published,0);assert.equal(x.op.json,saved);await x.sync.close();
 }
 x=await fixture();x.refuseEditor('permission-denied');x.sync.notify('room');await x.idle();assert.deepEqual(await x.sync.flush({forceProjects:false}),{ok:false,code:'LF_REMOTE_UNCONFIRMED'});assert.equal(x.op.phase,'queued');assert.equal(x.published,0);assert.equal(x.dirty,true);await x.sync.close();
 x=await fixture();assert.equal((await x.sync.flush()).ok,true);assert.equal(x.published,1);await x.sync.close();
 for(const options of [{handover:true},{kind:'quote'},{now:999999}]){x=await fixture(options);assert.equal(x.published,1);await x.sync.close();}
 x=await fixture({phase:'uncertain'});assert.equal(x.published,0);assert.equal(x.op.phase,'verified');await x.sync.close();
 x=await fixture({online:false});await x.advance(400000);assert.equal(x.published,0);x.online();await x.idle();assert.equal(x.published,1);await x.sync.close();x.online();await x.idle();assert.equal(x.published,1);
 assert.throws(()=>projectBatchDelay({phase:'queued',batch:{version:1,firstAt:2,lastAt:1}}),/LF_SYNC_BATCH_INVALID/);
 const value={document:{payload:{project:{id:'r',meta:{roomProject:{version:1,roomId:'r'}}},offers:[]}},globals:{pin:1}};
 const previous={key:'old',scope:'r',phase:'queued',json:JSON.stringify(value),hash:'h',base:null,editor:{deviceId:'d',epoch:1},localVersion:2,blockers:[],batch:{version:1,firstAt:1000,lastAt:1000}};
 const entry={scope:'r',operationId:'new',batchable:true,value,editor:previous.editor},old={version:2,json:previous.json,hash:'h',base:null};
 const args={entry,old,previous,operations:[previous],controls:[],now:2000};
 assert.equal(prepareProjectBatch(args).superseded.key,'old');
 for(const phase of ['inflight','uncertain','verified','conflict'])assert.equal(prepareProjectBatch({...args,previous:{...previous,phase}}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,operations:[previous,{dependencies:[{key:'old'}]}]}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,entry:{...entry,editor:{deviceId:'other',epoch:2}}}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,entry:{...entry,value:{...value,globals:{pin:2}}}}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,entry:{...entry,value:{...value,document:{payload:{...value.document.payload,offers:[{accepted:true}]}}}}}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,entry:{...entry,releaseAfterSync:true}}).batch,undefined);
 for(const key of ['handover:r','projectRecovery:r','retired:r'])assert.equal(prepareProjectBatch({...args,controls:[{key}]}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,now:121000}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,previous:{...previous,expected:{generation:2}}}).superseded,undefined);
 assert.equal(prepareProjectBatch({...args,old:{...old,base:{generation:2}}}).superseded,undefined);
 const {createApplicationQuoteLedger}=await import('../sync/application-quote-ledger.mjs'),{digest}=await import('../sync/local-first-values.mjs');
 const record={id:'r',investorId:'i'},document={payload:{project:record},integrity:{documentSha256:'a'.repeat(64)}},encoded=JSON.stringify({document});
 const source={replica:{json:encoded,hash:await digest(encoded),base:{generation:1},dirty:true},operations:[{phase:'queued',batch:{version:1,firstAt:1,lastAt:1}}]};
 let flushes=0,acknowledge=false,retired=false;
 const ledger=createApplicationQuoteLedger({fc:{projectModel:{normalizeProjectRecord:v=>v},investors:{getCurrentId:()=> 'i'}},store:{snapshot:async()=>structuredClone(source),retired:async()=>retired},getSync:()=>({async flush(){flushes++;if(acknowledge){source.replica.dirty=false;source.replica.base={generation:2};source.operations[0].phase='verified';}return {ok:true};}})});
 const refs=[{projectId:'r',roomId:'r',investorId:'i',recordHash:await digest(record)}];
 await assert.rejects(ledger.proof.sources(refs),/LF_QUOTE_SOURCE_UNCONFIRMED/);assert.equal(flushes,1,'flush OK alone is never an ACK');
 acknowledge=true;assert.deepEqual((await ledger.proof.sources(refs))[0].head,{generation:2});assert.equal(flushes,2);
 await assert.rejects(ledger.proof.sources([{...refs[0],recordHash:'b'.repeat(64)}]),/LF_QUOTE_SOURCE_INTEGRITY/);
 retired=true;await assert.rejects(ledger.proof.sources(refs),/LF_QUOTE_SOURCE_UNCONFIRMED/);
 const {createDurableSynchronizer}=await import('../sync/local-first-sync.mjs');
 for(const [kind,proven]of [['project',true],['project',false],['quote',true]]){
  let connected=false,publishes=0;
  const old={key:'a',scope:'r',localVersion:1,phase:'queued',json:'{"n":1}',hash:'old',base:{generation:1},blockers:[],batch:{version:1,firstAt:1,lastAt:1}};
  let queued=structuredClone(old),dirty=true,remote={head:old.base,value:{n:0}};
  const store={exclusive:fn=>fn(),snapshot:async()=>({replica:{version:queued.localVersion,dirty,json:queued.json,hash:queued.hash,base:remote.head},operations:[structuredClone(queued)]}),
   wasProjectCoalesced:async op=>proven&&op.key===old.key,
   transition:async(key,from,to,patch)=>{if(key!==queued.key||queued.phase!==from)throw Object.assign(Error('LF_QUEUE_CONFLICT'),{code:'LF_QUEUE_CONFLICT'});Object.assign(queued,patch,{phase:to});if(to==='verified')dirty=false;return structuredClone(queued);}};
  const channel={scope:'r',kind,async prepare(value){if(value.n===1)queued={...old,key:'b',localVersion:2,json:'{"n":2}',hash:'new'};const expected={generation:2};return {expected,async publish(){publishes++;remote={head:expected,value};}};},read:async()=>structuredClone(remote),readHead:async()=>remote.head};
  const sync=createDurableSynchronizer({store,channels:[channel],eventTarget:new EventTarget(),online:()=>connected});connected=true;
  try{const result=await sync.flush();assert.equal(result.ok,kind==='project'&&proven);assert.equal(publishes,kind==='project'&&proven?1:0);if(!result.ok)assert.equal(result.code,'LF_QUEUE_CONFLICT');else{assert.equal(queued.phase,'verified');assert.deepEqual(remote.value,{n:2});}}
  finally{await sync.close();}
 }
 console.log('PASS P1 unit: 2m idle/5m maximum, explicit flush/Exit, offline wake, uncertain ACK, clocks, protected phases/pins/offers/dependencies and cleanup; quote pins require actual confirmed state, not flush OK');
})().catch(e=>{console.error(e);process.exitCode=1});
