import {confirmQuoteSources,applicationIdle} from './quote-ui-actions.mjs';
import assert from 'node:assert/strict';
import * as f from 'firebase/firestore';

// Real normal UI, real SDK and DEMO emulators. The idle deadline uses wall time;
// virtual-clock unit tests separately exercise the five-minute upper bound.
export async function batchingCase(c,{idle=true,quoteOnly=false,offlineQuote=false}={}){
 const {t,phone,computer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,showList,openRoom,addCabinet,saveProject,restartProbe,globalBefore}=c;
 const head=id=>f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',id)).then(d=>d.data());
 const scope=(state,id)=>state.outbox.filter(row=>row.scope===id);
 const record=(state,id)=>JSON.parse(rows(state).fc_projects_v1).find(row=>row.id===id);
 const saved=async device=>saveProject(device.page,{flush:false});
 const before=await image(phone),priorHead=await head(pid),priorOther=await head(wardrobeId);
 await Promise.all([saved(phone),saved(computer)]);
 const first=await image(phone),one=scope(first,pid).find(op=>op.phase==='queued');
 assert.ok(one?.batch,'A real Save must durably queue a timed project operation');
 assert.deepEqual(await head(pid),priorHead,'Local Save must not immediately publish');
 assert.deepEqual(await head(wardrobeId),priorOther);
 await addCabinet(phone,55);await saved(phone);
 const second=await image(phone),pending=scope(second,pid).filter(op=>op.phase!=='verified');
 assert.equal(pending.length,1);const batch=pending[0];assert.notEqual(batch.key,one.key);
 assert.equal(batch.batch.firstAt,one.batch.firstAt);assert.ok(batch.batch.lastAt>=one.batch.lastAt);
 const archive=second.control.find(row=>row.key==='p1-coalesced:'+one.key);
 assert.deepEqual(archive.operation,one);assert.equal(archive.replacedBy,batch.key);
 for(const op of [one,batch])assert.ok(second.protected.find(row=>row.key===op.key));
 assert.equal(record(second,pid).projectData[pid].cabinets.length,2);
 assert.deepEqual(await head(pid),priorHead);
 // Cancel affects the next uncommitted draft, never the two approved saves.
 await addCabinet(phone,44);await phone.page.locator('#sessionCancel').click();await phone.page.locator('.confirm-box .is-danger').click();
 await phone.page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 const cancelled=await image(phone);
 assert.deepEqual(scope(cancelled,pid),scope(second,pid));
 assert.equal(record(cancelled,pid).projectData[pid].cabinets.length,2);
 assert.equal(await phone.page.locator('#sessionCancel').innerText(),'Wyjdź');
 t.diagnostic('Real Save coalesced only queued work, retained RAW and archive; Cancel preserved approved data; no early server publication');
 let published;
 if(idle){
 // Observe a real 120s timer, rather than force a write or alter Firebase clocks.
 const due=Math.min(batch.batch.lastAt+120000,batch.batch.firstAt+300000);
 while(await phone.page.evaluate(()=>Date.now())<due-1500){
  assert.deepEqual(await head(pid),priorHead,'The batch published before its idle deadline');
  const remaining=due-1500-await phone.page.evaluate(()=>Date.now());
  await new Promise(resolve=>setTimeout(resolve,Math.min(10000,Math.max(1,remaining))));
 }
 await until(async()=>scope(await image(phone),pid).find(op=>op.key===batch.key)?.phase==='verified');
 assert.ok(await phone.page.evaluate(()=>Date.now())>=due,'A verified receipt preceded the durable browser deadline');const timed=await image(phone);published=await head(pid);
 assert.notEqual(published.currentRevisionId,priorHead.currentRevisionId);
 assert.equal(scope(timed,pid).length,scope(before,pid).length+1,'Two saves must produce one new confirmed revision');
 assert.equal(scope(timed,pid).find(op=>op.key===batch.key).receipt.currentRevisionId,published.currentRevisionId);
 await until(async()=>scope(await image(computer),wardrobeId).every(op=>op.phase==='verified'));
 t.diagnostic('Real two-minute timer published one latest room revision; independent room also obtained a real ACK');
 return;
 }
 if(quoteOnly){assert.equal((await computer.page.evaluate(()=>window.FC.applicationStartup.synchronize())).ok,true);await queuedReadRace(c);await addCabinet(phone,101);await saved(phone);await frozenQuote(c,4);return;}
 // Establish a confirmed base through the public explicit-sync API. The
 // separate idle case alone proves automatic deadline behavior.
 assert.equal((await phone.page.evaluate(()=>window.FC.applicationStartup.synchronize())).ok,true);
 assert.equal((await computer.page.evaluate(()=>window.FC.applicationStartup.synchronize())).ok,true);
 published=await head(pid);
 if(offlineQuote){await offlineDraft(c,3,true);return;}
 // Regression: ordinary Exit, immediate same-investor reopen and repeated Projects.
 await showList(phone.page);
 await phone.page.evaluate(async iid=>{
  const old=window.normalConnections[0],context=window.normalMainContext,lease=context.lease;
  window.normalRevokeConnectionLease();
  let refused=false;try{old.assertAccess();}catch(error){refused=error.message==='AUTH_ACCESS_REVOKED';}if(!refused)throw Error('OLD_LEASE_NOT_REVOKED');
  let state;const watch=window.FC.investorPresence.watchPresence(iid,()=>true,value=>{state=value.state;});watch.close();
  if(state!=='unconfirmed')throw Error('REVOKED_PRESENCE_CONFIRMED');
  const next={...context,lease:{uid:lease.uid,isValid:()=>lease.isValid(),assert:()=>lease.assert()}};
  const before=window.normalConnectionEpoch;
  await window.FC.applicationStartup.beforeBusiness(next);await window.FC.applicationStartup.start(next);
  if(window.normalConnectionEpoch!==before+1)throw Error('FRESH_LEASE_NOT_REBOUND');
  window.normalConnections[0].assertAccess();
  try{old.assertAccess();throw Error('OLD_LEASE_ACCEPTED');}catch(error){if(error.message==='OLD_LEASE_ACCEPTED')throw error;}
 },iid);
 t.diagnostic('Revoked old connection and presence refuse; fresh authorized start rebinds real SDK connections without losing local state');
 await phone.page.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();
 await phone.page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 assert.equal(await phone.page.locator('.info-box').count(),0,'Reopening after Exit must not refuse: '+await phone.page.locator('body').innerText());
 const touch=await phone.page.context().newCDPSession(phone.page);
 await phone.page.setViewportSize({width:393,height:851});
 await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 for(let attempt=0;attempt<2;attempt++){
  const button=phone.page.locator('[data-investor-action="projects"]');
  if(attempt===0)await button.click();else{
   await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box);
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await phone.page.locator('.room-project-picker').waitFor({state:'visible'});
  await phone.page.waitForFunction(()=>document.querySelectorAll('.room-project-picker').length===1);
  await phone.page.locator('.room-project-picker .panel-box__close').click();
 }
 await touch.detach();
 await openRoom(phone,pid);
 await phone.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 t.diagnostic('Ordinary Exit/reopen and repeated Projects remain usable without losing the room');
 // Exit starts publication immediately. Kill after real server commit, before
 // its ACK reaches IndexedDB; restart must recover the same receipt, not replay.
 await addCabinet(phone,88);await saved(phone);
 const exiting=await image(phone),last=scope(exiting,pid).find(op=>op.phase==='queued');
 await phone.page.evaluate(pid=>window.normalHoldStatusHead=pid,pid);
 await showList(phone.page);
 await phone.page.waitForFunction(()=>window.normalStatusHeadCommitted===true);
 const committed=await head(pid);assert.notEqual(committed.currentRevisionId,published.currentRevisionId);
 assert.ok(Date.now()<last.batch.lastAt+120000,'Exit must not wait for the idle deadline');
 const held=await image(phone);assert.equal(scope(held,pid).find(op=>op.key===last.key).phase,'inflight');
 await phone.page.context().tracing.stop();await restartProbe(phone,{crash:true});await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 await until(async()=>scope(await image(phone),pid).find(op=>op.key===last.key)?.phase==='verified');
 assert.deepEqual(await head(pid),committed,'Lost ACK recovery must not publish a duplicate');
 assert.equal(record(await image(phone),pid).projectData[pid].cabinets.length,3);
 await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid))).data().active===false);
 await showList(computer.page);
 await until(async()=>record(await image(computer),pid)?.projectData[pid].cabinets.length===3);
 t.diagnostic('Real Exit, SIGKILL before ACK, durable restart, verified receipt and release preserved all three cabinets without duplicate publication');
 await offlineDraft(c,4,false);
}

async function offlineDraft(c,count,quote){
 const {t,phone,computer,iid,pid,db,ownerUid,until,image,rows,showList,openRoom,addCabinet,saveProject,restartProbe}=c;
 let page=phone.page;await showList(page);
 await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid))).data().active===false);
 // Delivery finishes both editors; offline-quote deliberately retains the
 // peer's other room. Prove the intended registry, never release that peer.
 const peerScope=quote?c.wardrobeId:null;
 const peerDevice=quote?(await image(computer)).replicas.find(row=>row.key===peerScope)?.editor?.deviceId:null;
 if(quote)assert.ok(peerDevice);
 await until(async()=>{
  const registry=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();
  const peer=quote?(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',peerScope))).data():null;
  return registry.projects[pid]===false&&(!quote||registry.projects[peerScope]===true)
   &&Object.entries(registry.projects).every(([scope,active])=>active===(scope===peerScope))
   &&Object.keys(registry.visits).every(device=>device===peerDevice)
   &&(!quote||peer?.active===true&&peer.deviceId===peerDevice)
   &&await page.evaluate(applicationIdle)&&await computer.page.evaluate(applicationIdle);
 });
 await page.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();
 await page.waitForFunction(iid=>window.uiState.entry==='rooms'&&window.uiState.currentInvestorId===iid&&!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending,iid);
 await openRoom(phone,pid);await page.waitForFunction(()=>window.FC.session.active&&window.uiState.entry==='app'&&!window.FC.applicationStartup.inspect().transactionPending);
 const confirmed=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data();
 await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
 await addCabinet(phone,99);await saveProject(page,{flush:false});
 const offline=await image(phone),op=offline.outbox.find(row=>row.scope===pid&&row.phase==='queued');assert.ok(op?.batch);
 const record=state=>JSON.parse(rows(state).fc_projects_v1).find(row=>row.id===pid);
 assert.equal(record(offline).projectData[pid].cabinets.length,count);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data(),confirmed);
 let offlineOffer;
 if(quote){
  await page.locator('[data-action="tab"][data-tab="wycena"]').click();
  await page.waitForFunction(()=>window.uiState.activeTab==='wycena'&&!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
  await page.locator('[data-action="wycena-generate"]').click();
  const warning=page.locator('.quote-lock-warning');
  await warning.waitFor();
  assert.match(await warning.innerText(),/Brak połączenia/);
  await warning.getByRole('button',{name:'Tak',exact:true}).click();
  const badge=page.getByText('Wycena lokalna, niepotwierdzona',{exact:true});
  await badge.or(page.locator('.info-box')).first().waitFor({timeout:60000});
  assert.equal(await badge.isVisible(),true,'Offline quote refused: '+JSON.stringify(await page.locator('.info-box').allTextContents()));
  const local=await image(phone),saved=local.protected.filter(row=>row.key.startsWith('offline-quote:'));
  assert.equal(saved.length,1);
  offlineOffer=JSON.parse(saved[0].json).snapshot;
  assert.ok(offlineOffer.totals.grand>0);
  assert.equal(offlineOffer.scope.sourceProjects.find(ref=>ref.projectId===pid).revision,undefined);
  assert.deepEqual(local.outbox,offline.outbox);
  assert.equal(rows(local).fc_quote_snapshots_v1,rows(offline).fc_quote_snapshots_v1);
  assert.equal(await page.getByRole('button',{name:'PDF',exact:true}).first().isEnabled(),false);
  assert.equal(await page.getByRole('button',{name:'Zaakceptuj ofertę',exact:true}).count(),0);
  t.diagnostic('Real offline calculation preserved the local price and source hashes without publishing a quote');
 }
 await page.context().tracing.stop();await restartProbe(phone,{crash:true});page=phone.page;await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 const restarted=await image(phone);assert.equal(record(restarted).projectData[pid].cabinets.length,count);
 assert.equal(restarted.outbox.find(row=>row.key===op.key)?.phase,'queued','Restart must retain the not-yet-due queue');
 if(quote){
  assert.deepEqual(JSON.parse(restarted.protected.find(row=>row.key==='offline-quote:'+offlineOffer.id).json).snapshot,offlineOffer);
  assert.equal(rows(restarted).fc_edit_session_v1,null,'Restart must not reopen the edit closed before the offline quote');
 }
 t.diagnostic('Real offline Save and pending batch survived SIGKILL/restart without publishing or overwriting the confirmed head');
 if(quote){
  if(await page.evaluate(()=>window.uiState.entry!=='app'))await openRoom(phone,pid);
  await page.waitForFunction(()=>window.uiState.entry==='app'&&!window.FC.applicationStartup.inspect().transactionPending);
  await frozenQuote(c,count);
 }
}

async function frozenQuote(c,count){
 const {phone,pid,wardrobeId,db,ownerUid,until,image,rows,restartProbe,globalBefore}=c;const page=phone.page;
 // The tab router durably ends a clean restored session. Wait for that real
 // boundary before Calculate; a visible button alone is not a write receipt.
 await page.locator('[data-action="tab"][data-tab="wycena"]').click();
 await page.waitForFunction(()=>window.uiState.activeTab==='wycena'&&!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.equal(await page.evaluate(()=>window.FC.sessionNavigation.canCalculate()),true);
 await until(async()=>JSON.parse(rows(await image(phone)).fc_projects_v1).find(row=>row.id===wardrobeId)?.projectData[wardrobeId].cabinets[0]?.width===77);
 assert.ok((await image(phone)).outbox.filter(op=>op.scope===pid).some(op=>op.phase==='queued'&&op.batch));
 await page.locator('[data-action="wycena-generate"]').click();await confirmQuoteSources(page);
 // Measured four-cabinet calculation + source ACK took 34s on the local
 // Chromium host. Bound this new fixture's readiness at 60s; do not change
 // browser-launch/RPC timeouts or accept a preview before the local commit.
 try{await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending&&(document.querySelector('[data-quote-history-id]')||document.querySelector('.info-box')),null,{timeout:60000});}
 catch(error){const evidence=await page.evaluate(async()=>{const r=await window.FC.wycenaDiagnostics.buildReport({dryRun:false});return {trace:r.lastGenerateTrace,button:r.lastGenerateButtonEvent,status:window.FC.applicationStartup.inspect()};});throw Error('P1_QUOTE_NOT_DURABLE '+JSON.stringify(evidence));}
 assert.ok(await page.locator('[data-quote-history-id]').count(),'Immediate quote after Save refused: '+JSON.stringify(await page.locator('.info-box').allTextContents()));
 await until(async()=>{const state=await image(phone);return state.outbox.some(op=>op.scope.startsWith('p0b_quotes_')&&op.phase==='verified')&&state.outbox.every(op=>op.phase==='verified');});
 const quoted=await image(phone),offers=JSON.parse(rows(quoted).fc_quote_snapshots_v1||'[]');assert.equal(offers.length,1);
 const current=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data();assert.equal(offers[0].scope.sourceProjects.find(ref=>ref.projectId===pid).revision.currentRevisionId,current.currentRevisionId);
 assert.equal(JSON.parse(rows(quoted).fc_projects_v1).find(row=>row.id===pid).projectData[pid].cabinets.length,count);
 assert.equal(JSON.parse(rows(quoted).fc_projects_v1).find(row=>row.id===wardrobeId).projectData[wardrobeId].cabinets[0].width,77);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);

 await page.context().tracing.stop();await restartProbe(phone);await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});assert.deepEqual(JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1),offers);
}

async function queuedReadRace(c){
 const {t,phone,pid,db,ownerUid,until,image,addCabinet,saveProject}=c,page=phone.page;
 const before=await image(phone),previous=before.outbox.find(op=>op.scope===pid&&op.phase==='queued');assert.ok(previous?.batch);
 const head=await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid));
 await page.evaluate(pid=>{window.normalPauseRoomPreparation=pid;window.normalRaceSync=window.FC.applicationStartup.synchronize();return true;},pid);
 await page.waitForFunction(()=>window.normalRoomPreparationHeld===true);
 assert.equal((await image(phone)).outbox.find(op=>op.key===previous.key).phase,'queued');
 let replacement;
 try{
  await addCabinet(phone,88);await saveProject(page,{flush:false});
  const changed=await image(phone);assert.ok(!changed.outbox.some(op=>op.key===previous.key));
  assert.deepEqual(changed.control.find(row=>row.key==='p1-coalesced:'+previous.key).operation,previous);
  replacement=changed.outbox.find(op=>op.scope===pid&&op.phase==='queued');assert.ok(replacement);
  assert.deepEqual((await f.getDoc(head.ref)).data(),head.data(),'Read preparation cannot publish or block durable local Save');
 }finally{await page.evaluate(()=>window.normalContinueRoomPreparation());}
 const result=await page.evaluate(()=>window.normalRaceSync);
 assert.equal(result.ok,true,'A proven queued replacement must reschedule without losing the wake-up: '+JSON.stringify(result));
 await until(async()=>(await image(phone)).outbox.find(op=>op.key===replacement.key)?.phase==='verified');
 const after=await image(phone),op=after.outbox.find(op=>op.key===replacement.key);
 assert.equal((await f.getDoc(head.ref)).data().currentRevisionId,op.receipt.currentRevisionId);
 assert.equal(after.outbox.filter(op=>op.scope===pid).length,before.outbox.filter(op=>op.scope===pid).length);
 t.diagnostic('Real Save completed while a real Firestore preparation READ was held; only its durable queued replacement was published and ACK verified');
}
