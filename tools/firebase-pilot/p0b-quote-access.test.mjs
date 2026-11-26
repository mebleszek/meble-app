import test from 'node:test';import assert from 'node:assert/strict';
import {validateQuoteGenerationChange} from '../../sync/local-first-quote-contract.mjs';
import {createQuoteRelease} from '../../sync/application-quote-release.mjs';
import {validateQuoteRelease,validateQuoteReleaseReceipt,quoteReleaseEditor} from '../../sync/local-first-quote-release.mjs';
import {installManualSync} from '../../sync/application-manual-sync.mjs';
import {validateQuoteReservationIntent,quoteReservationRequest,validateQuoteReservationRequest,quoteReservationEditor,quoteReservationMarker,verifyQuoteReservation,releasedQuoteReservation} from '../../sync/quote-reservation-contract.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import {installQuoteReservations} from '../../sync/application-quote-reservations.mjs';
const copy=structuredClone;

function reservationIntent(mode='request'){
 return {key:'quote-reservation:kitchen',version:1,operationId:'11111111-1111-4111-8111-111111111111',token:'22222222-2222-4222-8222-222222222222',
  ownerUid:'owner',deviceId:'requester',deviceLabel:'Telefon – Chrome',investorId:'investor',projectId:'kitchen',mode,pinRevision:mode==='pin'?7:null,
  expected:{revision:'a'.repeat(32),editor:{ownerUid:'owner',investorId:'investor',projectId:'kitchen',deviceId:'editor',deviceLabel:'Komputer – Edge',epoch:3,active:mode!=='free',headRevision:'a'.repeat(32)}}};
}
test('P0-B quote access: reservation plans: free and PIN witnesses preserve exact source, owner and epoch',()=>{
 for(const mode of ['free','pin']){
  const intent=reservationIntent(mode),before=copy(intent);assert.equal(validateQuoteReservationIntent(intent,'owner','requester'),true);
  const expected={editor:quoteReservationEditor(intent),revision:intent.expected.revision},marker=quoteReservationMarker(intent);
  assert.deepEqual(verifyQuoteReservation(intent,expected,marker),{status:expected,marker});assert.equal(expected.editor.epoch,4);assert.ok(!Object.hasOwn(expected.editor,'purpose'),'The existing editor schema remains unchanged');
  for(const change of [value=>value.editor.epoch++,value=>value.editor.deviceId='other',value=>value.editor.unknown='ignored',value=>value.revision='b'.repeat(32),value=>value.editor.active=false]){
   const wrong=copy(expected);change(wrong);assert.throws(()=>verifyQuoteReservation(intent,wrong,marker),{code:'LF_QUOTE_RESERVATION_UNCONFIRMED'});
  }
  for(const change of [value=>value.epoch++,value=>value.token='33333333-3333-4333-8333-333333333333',value=>value.active=false,value=>value.deviceId='other',value=>value.revision='b'.repeat(32)]){
   const wrong=copy(marker);change(wrong);assert.throws(()=>verifyQuoteReservation(intent,expected,wrong),{code:'LF_QUOTE_RESERVATION_UNCONFIRMED'});
  }
  const released=releasedQuoteReservation(expected,marker);assert.equal(released.status.editor.active,false);assert.equal(released.status.editor.epoch,4);assert.equal(released.marker.active,false);
  assert.deepEqual(Object.keys(released.status.editor).sort(),Object.keys(intent.expected.editor).sort(),'Release preserves the compatible ordinary editor shape');
  assert.deepEqual(intent,before);assert.throws(()=>validateQuoteReservationIntent(intent,'foreign','requester'),{code:'LF_QUOTE_RESERVATION_INVALID'});
 }
 for(const change of [value=>value.mode='free',value=>value.pinRevision=1,value=>value.expected.editor.deviceId='requester',value=>value.expected.editor.ownerUid='foreign',value=>value.expected.editor.epoch=Number.MAX_SAFE_INTEGER,value=>value.unknown='ignored']){
  const invalid=reservationIntent();change(invalid);assert.throws(()=>validateQuoteReservationIntent(invalid,'owner','requester'),{code:'LF_QUOTE_RESERVATION_INVALID'});
 }
});
test('P0-B quote access: reservation requests: only the exact granted request can confirm the saved latest source',()=>{
 const intent=reservationIntent(),pending=quoteReservationRequest(intent),before=copy(intent);
 assert.equal(validateQuoteReservationRequest(pending),true);
 const granted={...pending,state:'granted',revision:'b'.repeat(32)},expected={editor:quoteReservationEditor(intent,granted.revision),revision:granted.revision},marker=quoteReservationMarker(intent,granted.revision);
 assert.deepEqual(verifyQuoteReservation(intent,expected,marker,granted),{status:expected,marker});
 for(const state of ['pending','declined','cancelled','released'])assert.throws(()=>verifyQuoteReservation(intent,expected,marker,{...pending,state,revision:state==='released'?granted.revision:''}),{code:'LF_QUOTE_RESERVATION_INVALID'});
 for(const change of [value=>value.requestId='33333333-3333-4333-8333-333333333333',value=>value.editorEpoch++,value=>value.requesterDeviceId='other',value=>value.projectId='wardrobe',value=>value.token='33333333-3333-4333-8333-333333333333',value=>value.unknown='ignored']){
  const wrong=copy(granted);change(wrong);assert.throws(()=>verifyQuoteReservation(intent,expected,marker,wrong),{code:'LF_QUOTE_RESERVATION_INVALID'});
 }
 assert.deepEqual(intent,before);assert.equal(pending.revision,'','A request alone never invents an ACK or a new source revision');
});

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

test('P0-B quote access: donor saves before grant and resumes an already committed grant after lost ACK',async()=>{
 const intent=reservationIntent(),request=quoteReservationRequest(intent),revision='b'.repeat(32);
 const editor={...intent.expected.editor,headRevision:revision};
 const image={version:2,rows:{fc_edit_session_v1:null}},replica={editor,base:{currentRevisionId:revision}};
 const prompt={},events=[];
 const document=Object.assign(new EventTarget(),{querySelector:()=>null});
 const win=Object.assign(new EventTarget(),{document,navigator:{onLine:true},uiState:{entry:'app',activeTab:'wywiad'}});
 let result,stage=null,remote={status:{editor:intent.expected.editor,revision:intent.expected.revision},request};
 let verified=false,grants=0;
 function change(answer){result=answer;}
 const store={ownerUid:intent.ownerUid,deviceId:editor.deviceId,retired:async()=>false,
  pendingQuoteReservations:async()=>[],pendingQuoteGrants:async()=>stage?[stage]:[],
  readApplication:async()=>image,snapshot:async()=>({replica}),
  async stageQuoteGrant(input){
   assert.equal(verified,true);assert.equal(win.FC.session.active,false);
   assert.equal(input.image,image);assert.equal(input.replica,replica);assert.deepEqual(input.request,request);
   input.assertAccess();events.push('intent');stage={request,editor,revision};
  },
  async finishQuoteGrant({expected,observed,assertAccess}){
   assertAccess();assert.equal(expected,stage);verifyQuoteReservation(intent,observed.status,observed.marker,observed.request);
   stage=null;events.push('receipt');return {granted:true};
  },
 };
 const protocol={reservations:{watch(_iid,_pid,watch){prompt.watch=watch;return ()=>{};},inspect:async()=>copy(remote),
  async decide(input,action,head){
   assert.deepEqual(input,request);assert.equal(action,'grant');assert.equal(head,revision);
   grants++;events.push('commit');remote={request:{...request,state:'granted',revision},
    status:{editor:quoteReservationEditor(intent,revision),revision},marker:quoteReservationMarker(intent,revision)};
   throw Error('LOST_ACK');
  },
 }};
 win.FC={session:{active:true,projectId:intent.projectId},applicationStartup:{inspect:()=>({})},
  investors:{getCurrentId:()=>intent.investorId},projectStore:{getCurrentProjectId:()=>intent.projectId},
  applicationLifecycle:{run:(fn,kind)=>{assert.equal(kind,'project');return fn();}},
  sessionNavigation:{needsClosure:()=>win.FC.session.active,confirmedFinish(action){
   assert.equal(action,'save');events.push('save');win.FC.session.active=false;return true;
  }},tabNavigation:{setActiveTab(tab){win.uiState.activeTab=tab;}},
  choiceBox:{ask:()=>result},infoBox:{open(){}},
 };
 const sync={async flush(){
  events.push('flush');
  if(!verified)return {ok:false,code:'LF_REMOTE_UNCONFIRMED'};
  remote.status={editor,revision};return {ok:true};
 }};
 const install=()=>installQuoteReservations({window:win,store,protocol,getSync:()=>sync,
  getAuthority:()=>({assertIdle(){}}),label:()=>editor.deviceLabel,assertAccess(){},
  onError(error){events.push(error.code||error.message);},onGranted(pid){assert.equal(pid,intent.projectId);events.push('granted');},
 });
 const wait=async check=>{for(let i=0;i<100;i++){if(check())return;await delay(2);}assert.fail('Controller did not settle');};
 change('grant');const controller=install();controller.trackEditor(intent.projectId,intent.expected.editor);
 await wait(()=>events.includes('LF_REMOTE_UNCONFIRMED'));
 assert.deepEqual(events,['save','flush','LF_REMOTE_UNCONFIRMED']);assert.equal(stage,null);assert.equal(grants,0);
 await delay(0);
 verified=true;prompt.watch();await wait(()=>events.includes('LOST_ACK'));
 assert.ok(stage);assert.equal(grants,1);controller.close();
 const restarted=install();restarted.wake();await wait(()=>events.includes('granted'));restarted.close();
 assert.equal(grants,1);assert.equal(stage,null);
 assert.deepEqual(events.slice(3),['flush','intent','commit','LOST_ACK','receipt','granted']);
});
