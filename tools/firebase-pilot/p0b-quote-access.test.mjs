import test from 'node:test';import assert from 'node:assert/strict';
import {validateQuoteGenerationChange} from '../../sync/local-first-quote-contract.mjs';
import {createQuoteRelease} from '../../sync/application-quote-release.mjs';
import {validateQuoteRelease,validateQuoteReleaseReceipt,quoteReleaseEditor} from '../../sync/local-first-quote-release.mjs';
import {installManualSync} from '../../sync/application-manual-sync.mjs';
const copy=structuredClone;

test('P0-B quote access: generation-only history cannot remove, accept or modify frozen offers',()=>{
 const old={id:'first',generatedAt:1000,project:{status:'wycena'},meta:{source:'quote-generation',selectedByClient:true,acceptedAt:900,acceptedStage:'zaakceptowany'},calculationRegister:{generatedAt:999},totals:{grand:17.125}};
 const before={offers:[old]},added={offers:[{...copy(old),id:'next',meta:{selectedByClient:false,acceptedAt:0}},copy(old)]};assert.equal(validateQuoteGenerationChange(before,added),true);
 const refreshed=copy(before);refreshed.offers[0].generatedAt=2000;refreshed.offers[0].meta.source='quote-duplicate-refresh';refreshed.offers[0].calculationRegister.generatedAt=1999;
 assert.equal(validateQuoteGenerationChange(before,refreshed),true);
 for(const mutate of [v=>v.offers=[],v=>v.offers[0].totals.grand++,v=>v.offers[0].meta.selectedByClient=false,v=>v.offers[0].project.status='nowy',v=>v.offers[0].unknown='new']){
  const next=copy(refreshed);mutate(next);assert.throws(()=>validateQuoteGenerationChange(before,next),{code:'LF_QUOTE_HISTORY_IMMUTABLE'});
 }
 const unauthorized=copy(added);unauthorized.offers[0].meta.selectedByClient=true;assert.throws(()=>validateQuoteGenerationChange(before,unauthorized),{code:'LF_QUOTE_HISTORY_IMMUTABLE'});
 assert.deepEqual(before.offers[0],old);
});

function fixture({fault}={}){
 const uid='owner',deviceId='receiver',iid='investor',remote={},pending=new Map(),archives=[];let revision=1,advance=0,releases=0,failOnce=true;
 for(const projectId of ['kitchen','wardrobe'])remote[projectId]={revision:'a'.repeat(32),editor:{ownerUid:uid,investorId:iid,projectId,deviceId:'other-device',deviceLabel:'Other',active:true,epoch:3,headRevision:'a'.repeat(32)}};
 const targets=()=>Object.entries(remote).map(([projectId,expected])=>({projectId,expected:copy(expected)}));
 const store={deviceId,readApplication:async()=>({version:1,hash:'b'.repeat(64)}),pendingQuoteReleases:async()=>copy([...pending.values()]),
  async stageQuoteReleases({targets,pinRevision,deviceLabel}){
   if(fault==='idb')throw Error('LF_IDB_ABORTED');
   for(const target of targets){const row={key:'quote-release:'+target.projectId,version:1,deviceId,investorId:iid,projectId:target.projectId,operationId:'operation',pinRevision,deviceLabel,expected:copy(target.expected)};validateQuoteRelease(row,uid,deviceId);pending.set(row.projectId,row);}
   if(fault==='cas')remote.kitchen.editor.epoch++;
   if(fault==='pin')revision++;
  },
  async reauthorizeQuoteRelease(row,pinRevision){const next={...row,pinRevision};validateQuoteRelease(next,uid,deviceId);pending.set(row.projectId,next);},
  async finishQuoteRelease(intent,outcome,observed){const row={key:'quote-release-done:'+intent.operationId+':'+intent.projectId,version:1,intent:copy(intent),outcome,observed:copy(observed)};validateQuoteReleaseReceipt(row,uid,deviceId);archives.push(row);pending.delete(intent.projectId);return row;}
 };
 const protocol={pin:{status:async()=>({revision}),verify:async pin=>{if(pin!=='synthetic-correct')throw Error('LF_P0B_PIN_INCORRECT');return revision;}},projectStatus:async(_iid,pid)=>copy(remote[pid]),
  async advanceEditor(args){assert.deepEqual(remote[args.pid],args.expected);advance++;remote[args.pid]={editor:quoteReleaseEditor(pending.get(args.pid)),revision:args.expected.revision};if(fault==='advance-ack'&&failOnce){failOnce=false;throw Error('ACK_LOST');}return remote[args.pid].editor;},
  async release(args){assert.deepEqual(remote[args.pid].editor,args.expectedEditor);releases++;remote[args.pid].editor.active=false;if(fault==='release-ack'&&failOnce){failOnce=false;throw Error('ACK_LOST');}return remote[args.pid].editor;}
 };
 return {remote,targets,pending,archives,store,protocol,count:()=>({advance,releases}),service:()=>createQuoteRelease({store,protocol,assertAccess(){},label:()=> 'Receiver'})};
}
test('P0-B quote access: durable release resumes lost takeover/release ACK without a second epoch or publication',async()=>{
 for(const fault of [undefined,'advance-ack','release-ack']){
  const f=fixture({fault}),before=copy(f.remote),targets=f.targets(),service=f.service();
  const action=()=>service.release({investorId:'investor',targets,pin:'synthetic-correct'});
  if(fault==='release-ack'){await assert.rejects(action(),/ACK_LOST/);assert.ok(f.pending.size);await f.service().resume();}else await action();
  assert.deepEqual(f.count(),{advance:2,releases:2});assert.equal(f.pending.size,0);assert.equal(f.archives.length,2);
  for(const [pid,state]of Object.entries(f.remote)){assert.equal(state.editor.active,false);assert.equal(state.editor.epoch,before[pid].editor.epoch+1);assert.equal(state.revision,before[pid].revision);}
 }
 const concurrent=fixture(),service=concurrent.service(),verify=concurrent.protocol.pin.verify;let releasePin;
 concurrent.protocol.pin.verify=pin=>new Promise(resolve=>{releasePin=()=>resolve(verify(pin));});
 const command=service.release({investorId:'investor',targets:concurrent.targets(),pin:'synthetic-correct'});
 let resumed=false;const recovery=service.resume().then(()=>resumed=true);await Promise.resolve();assert.equal(resumed,false,'Resume cannot report completion while PIN verification is still preparing its intent');
 await assert.rejects(service.release({investorId:'investor',targets:concurrent.targets(),pin:'synthetic-correct'}),{code:'LF_APPLICATION_BUSY'});
 releasePin();await Promise.all([command,recovery]);assert.equal(concurrent.pending.size,0);assert.deepEqual(concurrent.count(),{advance:2,releases:2});
});
test('P0-B quote access: bad PIN, IDB abort, CAS and changed PIN never produce false release',async()=>{
 const wrong=fixture(),before=copy(wrong.remote);await assert.rejects(wrong.service().release({investorId:'investor',targets:wrong.targets(),pin:'incorrect'}),/PIN_INCORRECT/);assert.deepEqual(wrong.remote,before);assert.equal(wrong.pending.size,0);
 for(const fault of ['idb','cas','pin']){
  const f=fixture({fault}),targets=f.targets(),service=f.service();
  await assert.rejects(service.release({investorId:'investor',targets,pin:'synthetic-correct'}),new RegExp(fault==='idb'?'IDB_ABORTED':fault==='cas'?'EDITOR_CONFLICT':'PIN_CONFLICT'));
  assert.deepEqual(f.count(),{advance:0,releases:0});
  if(fault==='pin'){
   // Explicitly re-entered, newly verified PIN reauthorizes the unchanged intent.
   await service.release({investorId:'investor',targets,pin:'synthetic-correct'});assert.equal(f.pending.size,0);assert.deepEqual(f.count(),{advance:2,releases:2});
  }
 }
 const f=fixture();await f.store.stageQuoteReleases({targets:f.targets(),pinRevision:1,deviceLabel:'Receiver'});const marker=[...f.pending.values()][0];
 assert.throws(()=>validateQuoteRelease({...marker,pin:'1234'},'owner','receiver'),/QUOTE_RELEASE_INVALID/);
 assert.throws(()=>validateQuoteReleaseReceipt({key:'quote-release-done:operation:kitchen',version:1,intent:marker,outcome:'changed',observed:{}},'owner','receiver'),/QUOTE_RELEASE_INVALID/);
});
test('P0-B quote access: header Sync waits for local completion, deduplicates and never turns a refusal green',async()=>{
 const listeners=new Map(),events=new Map(),button={dataset:{},setAttribute(){},addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 let local,remote,calls=0,notices=0;const idle=new Promise(resolve=>local=resolve),flush=new Promise(resolve=>remote=resolve);
 const w={document:{getElementById:()=>button},FC:{infoBox:{open(){notices++;}}},addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)};
 const sync={async flush(){calls++;return flush;}},control=installManualSync({window:w,boundary:{whenIdle:()=>idle},getSync:()=>sync,assertAccess(){}});
 const a=listeners.get('click')(),b=listeners.get('click')();assert.equal(calls,0);assert.equal(button.dataset.syncState,'busy');
 local();await Promise.resolve();assert.equal(calls,1);remote({ok:false,code:'LF_ACTIVE_RAM_PROTECTED'});await Promise.all([a,b]);assert.equal(button.dataset.syncState,'error');assert.equal(notices,1);
 sync.flush=async()=>({ok:true});await listeners.get('click')();assert.equal(button.dataset.syncState,'success');control.reset();assert.equal(button.dataset.syncState,'idle');control.close();assert.equal(button.disabled,true);assert.equal(listeners.size,0);assert.equal(events.size,0);
});

test('P0-B quote access: historical generation has no editor acquisition and cannot masquerade as room/settings writes',async()=>{
 const {installApplicationWriteBoundary}=await import('../../sync/application-write-boundary.mjs');
 const {createApplicationCommitter}=await import('../../sync/application-replication.mjs');
 let editors=0;const kinds=[],w={FC:{}};
 const boundary=installApplicationWriteBoundary({window:w,registry:'p0b-rooms-v1',ensureEditor:async()=>editors++,authority:{transaction:async(kind,fn,options)=>{kinds.push({kind,options});return fn();}}});
 assert.equal(await w.FC.applicationWrite.quote(()=>17),17);assert.equal(await w.FC.applicationWrite.offerDraft(()=>18),18);assert.equal(editors,0);
 await w.FC.applicationWrite.project(()=>true);assert.equal(editors,1);assert.deepEqual(kinds.slice(0,2),[{kind:'quote',options:{writeScopes:[]}},{kind:'quote-draft',options:undefined}]);boundary.close();
 const original={fc_projects_v1:'[{"id":"room"}]',fc_current_project_id_v1:'room',fc_current_investor_v1:'investor',fc_quote_offer_drafts_v1:'[]',fc_ui_v1:'{}',fc_company_v1:'{"exact":17.125}'};
 let commits=0,validated=0;const store={readApplication:async()=>({rows:original}),checkpointApplication:async()=>{commits++;return true;}};
 const writer=createApplicationCommitter({store,projectContract:{validateOfferDraftChange(){validated++;}}});
 await writer.checkpoint({rows:{...original,fc_ui_v1:'{"selected":"next"}'}},'quote-draft');assert.equal(validated,0);
 await writer.checkpoint({rows:{...original,fc_quote_offer_drafts_v1:'[{"projectId":"room"}]'}},'quote-draft');assert.equal(validated,1);
 for(const key of ['fc_projects_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_company_v1','fc_quote_snapshots_v1','fc_edit_session_v1'])await assert.rejects(writer.checkpoint({rows:{...original,[key]:'changed'}},'quote-draft'),{code:'LF_APPLICATION_SCOPE_REFUSED'});
 assert.equal(commits,2);
});