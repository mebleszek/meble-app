import assert from 'node:assert/strict';
import path from 'node:path';
import * as f from 'firebase/firestore';

// These helpers drive the existing normal bootstrap, SDK and real controls.
export async function promotionCase(c){
 const {t,phone,computer,offer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,showList,restartProbe,artifacts,globalBefore}=c;
 let page=phone.page;
 const preview=await page.evaluate(offer=>{
  try{return {ok:!!window.FC.quoteSnapshotStore.previewSelection('convertPreliminaryToFinal',[offer.project.id,offer.id],window.FC.projectDomainOperations.readHistory()).result};}
  catch(e){return {ok:false,code:e.code||e.message};}
 },offer);
 assert.equal(preview.ok,true,'Promotion preview must be valid: '+JSON.stringify(preview));
 await showList(computer.page);
 await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data().active===false);
 async function invoke(promote){
  await page.evaluate(promote=>{
   const api=window.FC.projectStatusSync,key=promote?'promotePreliminarySnapshotToFinal':'commitAcceptedSnapshot',original=api[key];
   window.normalLifecycleResult=undefined;
   api[key]=async function(...args){try{const result=await original.apply(this,args);window.normalLifecycleResult=result;return result;}
    catch(e){window.normalLifecycleResult={ok:false,code:e.code||e.message};throw e;}finally{api[key]=original;}};
  },promote);
  const row=page.locator('[data-quote-history-id="'+offer.id+'"]');
  await row.getByRole('button',{name:promote?'Końcowa':'Zaakceptuj',exact:true}).click();
  if(!promote)await page.locator('.confirm-box').getByRole('button',{name:'Zaakceptuj ofertę',exact:true}).click();
  await page.waitForFunction(()=>window.normalLifecycleResult!==undefined);
  return page.evaluate(()=>window.normalLifecycleResult);
 }
 assert.equal((await invoke(false)).ok,true);
 await until(async()=>(await image(phone)).outbox.every(row=>row.phase==='verified'));
 const accepted=await image(phone),preliminary=JSON.parse(rows(accepted).fc_quote_snapshots_v1).find(row=>row.id===offer.id);
 assert.ok(preliminary.meta.preliminary&&preliminary.meta.selectedByClient);
 for(const id of [pid,wardrobeId])assert.equal(JSON.parse(rows(accepted).fc_projects_v1).find(row=>row.id===id).status,'pomiar');
 // Establish the competing actor through the existing validated protocol on
 // the peer's real authenticated connection. Opening/recovering that peer's
 // unrelated old editor UI is not a prerequisite for this promotion regression.
 const peerDevice=(await image(computer)).replicas.find(row=>row.key===wardrobeId).editor.deviceId;
 await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data().active===false);
 const foreign=await computer.page.evaluate(async({iid,pid,deviceId})=>{
  const {createP0BProtocol}=await import('/tools/firebase-pilot/p0b-protocol.mjs');
  const {p0bConnection}=await import('/sync/application-p0b-domain.mjs');
  const protocol=createP0BProtocol(p0bConnection(window.normalConnections[0]),deviceId);
  const witness=await protocol.projectStatus(iid,pid);
  const editor=await protocol.acquire({iid,pid,expectedHead:witness.revision,deviceLabel:'Komputer DEMO'});
  window.normalPromotionLease={protocol,editor};
  return editor;
 },{iid,pid:wardrobeId,deviceId:peerDevice});
 const beforeBusy=await image(phone);
 assert.equal((await invoke(true)).code,'LF_QUOTE_EDITOR_BUSY');
 assert.deepEqual(await image(phone),beforeBusy);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data(),foreign);
 await page.locator('.info-box .is-success').click();
 await computer.page.evaluate(async()=>{
  const {protocol,editor}=window.normalPromotionLease;
  await protocol.release({iid:editor.investorId,pid:editor.projectId,expectedHead:editor.headRevision,expectedEditor:editor});
 });
 await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data().active===false);
 const beforeAbort=await image(phone);
 await page.evaluate(()=>{
  const original=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,...args){const result=original.call(this,value,...args);
   if(this.name==='control'&&value?.key==='application'&&JSON.parse(value.rows.fc_quote_snapshots_v1||'[]').some(row=>row.meta?.selectedByClient&&!row.meta.preliminary)){
    IDBObjectStore.prototype.put=original;queueMicrotask(()=>this.transaction.abort());
   }return result;
  };
 });
 assert.equal((await invoke(true)).code,'LF_IDB_ABORTED');
 const aborted=await image(phone);assert.deepEqual(rows(aborted),rows(beforeAbort));assert.deepEqual(aborted.outbox,beforeAbort.outbox);
 await page.locator('.info-box .is-success').click();
 await page.context().tracing.stop({path:path.join(artifacts,'promotion-abort.zip')});
 await restartProbe(phone,{crash:true});page=phone.page;
 await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 for(const key of ['fc_projects_v1','fc_quote_snapshots_v1','fc_investors_v1'])assert.equal(rows(await image(phone))[key],rows(beforeAbort)[key]);
 await page.locator('[data-action="tab"][data-tab="wycena"]').filter({visible:true}).first().click();
 assert.equal((await invoke(true)).ok,true,'UI must wait for durable promotion');
 await until(async()=>(await image(phone)).outbox.every(row=>row.phase==='verified'));
 const after=await image(phone),final=JSON.parse(rows(after).fc_quote_snapshots_v1).find(row=>row.id===offer.id);
 assert.equal(final.meta.preliminary,false);assert.equal(final.commercial.preliminary,false);assert.equal(final.meta.selectedByClient,true);
 for(const key of ['scope','lines','totals','calculationRegister','clientOffer'])assert.deepEqual(final[key],preliminary[key],key+' is frozen');
 for(const id of [pid,wardrobeId]){
  const record=JSON.parse(rows(after).fc_projects_v1).find(row=>row.id===id);
  assert.equal(record.status,'zaakceptowany');assert.equal(record.projectData.meta.roomDefs[id].projectStatus,'zaakceptowany');
  assert.deepEqual(record.projectData[id],JSON.parse(rows(accepted).fc_projects_v1).find(row=>row.id===id).projectData[id]);
 }
 const added=after.outbox.filter(op=>!beforeAbort.outbox.some(old=>old.key===op.key));assert.equal(added.length,3);
 assert.equal(new Set(added.map(row=>row.applicationHash)).size,1);
 const head=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data();
 await page.context().tracing.stop({path:path.join(artifacts,'promotion-complete.zip')});
 await restartProbe(phone,{crash:true});
 assert.deepEqual(JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1).find(row=>row.id===offer.id),final);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data(),head);
 await until(async()=>{const state=await image(computer);return [pid,wardrobeId].every(id=>JSON.parse(rows(state).fc_projects_v1).find(row=>row.id===id)?.status==='zaakceptowany')&&JSON.parse(rows(state).fc_quote_snapshots_v1).some(row=>row.id===offer.id&&!row.meta.preliminary);});
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 t.diagnostic('Promotion: real UI, both status CAS, foreign refusal, IDB abort, SIGKILL, frozen sources/history and peer receipt PASS');
}

export async function stagingCase(c){
 const {t,phone,computer,offer,iid,db,ownerUid,until,image,rows,showList,restartProbe,artifacts,globalBefore}=c;
 let page=phone.page;
 await page.waitForFunction(()=>!!window.normalQuoteChunkStaged);
 const staged=await image(phone),op=staged.outbox.find(row=>row.scope.startsWith('p0b_quotes_'));
 assert.equal(op.phase,'inflight');assert.ok(op.expected);
 const ref=(...parts)=>f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid,...parts);
 const revision=(await f.getDoc(ref('revisions',op.expected.revisionId))).data();
 assert.ok(revision&&revision.chunks.length>0);
 assert.equal((await f.getDoc(ref())).exists(),false,'No head before staging interruption');
 const first=(await f.getDoc(ref('revisions',op.expected.revisionId,'chunks','0'))).data();assert.ok(first);
 await page.context().tracing.stop({path:path.join(artifacts,'quote-staged.zip')});
 // Network failure after a genuinely committed chunk makes the durable op uncertain.
 await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
 await page.evaluate(()=>{window.normalContinueQuoteChunk();return true;});
 await until(async()=>(await image(phone)).outbox.find(row=>row.key===op.key)?.phase==='uncertain');
 await restartProbe(phone,{crash:true});page=phone.page;
 await until(async()=>(await image(phone)).outbox.find(row=>row.key===op.key)?.phase==='verified').catch(async error=>{
  const state=await image(phone),current=state.outbox.find(row=>row.key===op.key);
  t.diagnostic('Staged recovery RED: '+JSON.stringify({phase:current?.phase,code:current?.code,expected:current?.expected,head:(await f.getDoc(ref())).data()||null}));throw error;
 });
 const verified=(await image(phone)).outbox.find(row=>row.key===op.key);
 assert.deepEqual(verified.expected,op.expected,'Resume the same revision, never generate a replacement');
 assert.deepEqual(verified.receipt,op.expected);
 assert.deepEqual((await f.getDoc(ref('revisions',op.expected.revisionId))).data(),revision);
 assert.deepEqual((await f.getDoc(ref('revisions',op.expected.revisionId,'chunks','0'))).data(),first);
 const head=(await f.getDoc(ref())).data();assert.equal(head.revisionId,op.expected.revisionId);
 assert.deepEqual(JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1).find(row=>row.id===offer.id),offer);
 await until(async()=>JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1||'[]').some(row=>row.id===offer.id));
 await restartProbe(phone,{crash:true});assert.deepEqual((await f.getDoc(ref())).data(),head);
 // A second real quote is staged, then resumed online with a genuinely lost ACK.
 await showList(computer.page);
 await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',c.wardrobeId))).data().active===false);
 async function stageNext(promote){
  page=phone.page;
  await page.locator('[data-action="tab"][data-tab="wycena"]').filter({visible:true}).first().click();
  await page.waitForFunction(()=>window.uiState.activeTab==='wycena'&&!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending);
  const before=await image(phone);
  await page.evaluate(()=>{window.normalQuoteChunkStaged=null;window.normalPauseQuoteChunk=true;});
  const history=page.locator('[data-quote-history-id="'+offer.id+'"]');
  await history.getByRole('button',{name:promote?'Końcowa':'Zaakceptuj',exact:true}).click();
  if(!promote)await page.locator('.confirm-box').getByRole('button',{name:'Zaakceptuj ofertę',exact:true}).click();
  await page.waitForFunction(()=>!!window.normalQuoteChunkStaged);
  const next=(await image(phone)).outbox.find(row=>row.scope===op.scope&&!before.outbox.some(old=>old.key===row.key));assert.ok(next);
  await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
  await page.evaluate(()=>{window.normalContinueQuoteChunk();return true;});
  await until(async()=>(await image(phone)).outbox.find(row=>row.key===next.key)?.phase==='uncertain');
  return next;
 }
 const ackOp=await stageNext(false);
 await page.evaluate(()=>{window.normalQuoteHeadCommitted=false;window.normalLoseQuoteAck=true;});
 await page.context().setOffline(false);await page.waitForFunction(()=>window.normalQuoteHeadCommitted===true);
 const ackHead=(await f.getDoc(ref())).data();assert.equal(ackHead.revisionId,ackOp.expected.revisionId);
 await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
 await page.evaluate(()=>{window.normalReleaseQuoteAckLoss();return true;});
 await until(async()=>(await image(phone)).outbox.find(row=>row.key===ackOp.key)?.phase==='uncertain');
 await restartProbe(phone,{crash:true});
 await until(async()=>(await image(phone)).outbox.find(row=>row.key===ackOp.key)?.phase==='verified');
 assert.deepEqual((await f.getDoc(ref())).data(),ackHead,'Lost resume ACK must not create another head');
 const conflictOp=await stageNext(true),localBeforeConflict=await image(phone);
 // A competing authorized writer commits another valid immutable revision,
 // using the same already-confirmed content; the stale staged writer must lose.
 const current=(await f.getDoc(ref())).data(),previous=(await f.getDoc(ref('revisions',current.revisionId))).data();
 const rid=crypto.randomUUID().replaceAll('-',''),competing={...current,generation:current.generation+1,revisionId:rid};
 await f.setDoc(ref('revisions',rid),{...previous,generation:competing.generation,revisionId:rid,previous:current.revisionId,createdAt:f.serverTimestamp()});
 for(let index=0;index<previous.chunks.length;index++)await f.setDoc(ref('revisions',rid,'chunks',String(index)),(await f.getDoc(ref('revisions',current.revisionId,'chunks',String(index)))).data());
 await f.runTransaction(db,async tx=>{const actual=await tx.get(ref());assert.equal(actual.data().revisionId,current.revisionId);tx.set(ref(),{...competing,updatedAt:f.serverTimestamp()});},{maxAttempts:1});
 const competingHead=(await f.getDoc(ref())).data();
 let refused=false;try{await restartProbe(phone,{crash:true});}catch{refused=true;}
 t.diagnostic('Conflicting startup refused: '+refused+'; operation state and missing receipt are checked independently');
 const conflictState=await image(phone),blocked=conflictState.outbox.find(row=>row.key===conflictOp.key);
 assert.equal(blocked.phase,'conflict');assert.equal(blocked.code,'LF_QUOTE_CAS_CONFLICT');assert.equal(blocked.receipt,undefined);assert.deepEqual(blocked.expected,conflictOp.expected);
 assert.equal(rows(conflictState).fc_quote_snapshots_v1,rows(localBeforeConflict).fc_quote_snapshots_v1,'Preserve unconfirmed local history on conflict');
 assert.deepEqual((await f.getDoc(ref())).data(),competingHead,'A staged old writer must never overwrite the newer head');
 await envRevisionCount();
 async function envRevisionCount(){await c.env.withSecurityRulesDisabled(async ctx=>{
  const revisions=await f.getDocs(f.collection(ctx.firestore(),'users',ownerUid,'p0bRoomQuotes',iid,'revisions'));
  assert.equal(revisions.size,4,'Three own immutable revisions and one competing revision, no duplicate resume IDs');
 });}
 t.diagnostic('Resume ACK loss reconciled after SIGKILL; a newer competing CAS head fences the staged writer and preserves local history');
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 t.diagnostic('Staged publication: real revision/chunk, offline uncertain, SIGKILL and same-revision resume without duplicates');
}
