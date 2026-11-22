import {confirmQuoteSources} from './quote-ui-actions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as f from 'firebase/firestore';

export async function rapidQuoteRemoval(c){
 const {t,phone,computer,offer,wardrobeId,until,image,rows,showList,restartProbe,artifacts}=c;let page=phone.page;
 const history=state=>JSON.parse(rows(state).fc_quote_snapshots_v1||'[]');
 await showList(computer.page);await until(async()=>!(await image(computer)).replicas.find(row=>row.key===wardrobeId).editor?.active);
 await computer.page.locator('[data-action="close-investors-list"]').click();
 await until(async()=>(await image(phone)).outbox.every(row=>row.phase==='verified'));
 const before=await image(phone);
 await page.evaluate(()=>{
  const writer=window.FC.applicationWrite,remove=writer.quoteRemoval;
  writer.quoteRemoval=(ids,changed,fn)=>remove(ids,changed,async()=>{const result=await fn();window.rapidDeletionApplied=true;await new Promise(resolve=>window.releaseRapidDeletion=resolve);return result;});
  const store=window.FC.quoteOfferStore,settled=store.settingsSettled;
  store.settingsSettled=()=>{window.rapidGenerateRequested=true;return settled.call(store);};
 });
 await page.locator('[data-quote-history-id="'+offer.id+'"] .btn-danger').click();await page.getByRole('button',{name:'Usuń ofertę',exact:true}).click();
 await page.waitForFunction(()=>window.rapidDeletionApplied);
 assert.deepEqual(history(await image(phone)),history(before),'No premature durable deletion before commit');
 await page.getByRole('button',{name:'Wyceń',exact:true}).click();await page.waitForFunction(()=>window.rapidGenerateRequested);
 await page.evaluate(()=>window.releaseRapidDeletion());
 await page.waitForFunction(()=>document.querySelector('.info-box')||(!window.FC.applicationStartup.inspect().transactionPending&&document.querySelector('[data-quote-history-id]')));
 assert.equal(await page.locator('.info-box').count(),0,'Immediate calculate must await local deletion: '+await page.locator('.info-box').allTextContents());
 const next=history(await image(phone));assert.equal(next.length,1);assert.notEqual(next[0].id,offer.id);assert.deepEqual(next[0].totals,offer.totals);
 await until(async()=>(await image(phone)).outbox.every(row=>row.phase==='verified'));
 await until(async()=>{const received=history(await image(computer));return received.length===next.length&&received.every(row=>next.some(value=>value.id===row.id));});
 assert.deepEqual(history(await image(computer)),next);
 await page.context().tracing.stop({path:artifacts+'/rapid-removal.zip'});await restartProbe(phone,{crash:true});page=phone.page;
 await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});assert.deepEqual(history(await image(phone)),next);
 await page.context().tracing.stop({path:artifacts+'/rapid-removal-restart.zip'});
 t.diagnostic('Real delete/calculate overlap awaits durable local commit; deleted ID stays absent through ACK, peer receive and SIGKILL/restart');
}
export async function phoneQuoteFlow(c){
 const {t,phone,offer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,showList,projects,openRoom,saveProject,artifacts,restartProbe,device,configure,login}=c;
 let computer=c.computer;
 const history=state=>JSON.parse(rows(state).fc_quote_snapshots_v1||'[]');
 await until(async()=>history(await image(computer)).some(row=>row.id===offer.id));
 await showList(phone.page);await showList(computer.page);
 await until(async()=>{const r=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();return Object.values(r.projects).every(v=>!v)&&Object.keys(r.visits).length===0;});
 await phone.page.locator('[data-action="close-investors-list"]').click();
 computer=await device('quote-receiver',{configureFirst:true});
 await until(async()=>history(await image(computer)).some(row=>row.id===offer.id));
 let page=computer.page;await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 await showList(page);
 try{
 await page.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();await projects(page);
 await openRoom(computer,pid);await page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 const before=await image(computer),other=JSON.parse(rows(before).fc_projects_v1).find(row=>row.id===wardrobeId);
 assert.equal(JSON.parse(rows(before).fc_quote_offer_drafts_v1||'[]').some(row=>row.projectId===pid),false,'Receiving a frozen quote does not imply a saved local settings draft');
 await page.locator('#floatingAdd').click();await page.locator('#cabinetTypeChoices .choice-tile').filter({hasText:'Szafka wisząca'}).click();
 await page.locator('#cmWidth').fill('60');await page.locator('#cmHeight').fill('94.2');await page.locator('#cmDepth').fill('36');
 await page.locator('#cabinetModalSave').click();await page.locator('#cabinetModal').waitFor({state:'hidden'});
 await saveProject(page,{flush:false});
 const saved=await image(computer),record=JSON.parse(rows(saved).fc_projects_v1).find(row=>row.id===pid);
 assert.deepEqual(JSON.parse(rows(saved).fc_projects_v1).find(row=>row.id===wardrobeId),other);
 assert.equal(record.projectData[pid].cabinets.length,2);
 assert.ok(record.projectData[pid].cabinets.some(row=>row.type==='wisząca'&&row.width===60));
 await page.locator('[data-action="tab"][data-tab="wycena"]').click();
 if(await page.locator('.confirm-box').isVisible())await page.getByRole('button',{name:'Zapisz i przejdź',exact:true}).click();
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 const scopeProbe=await page.evaluate(()=>{const fc=window.FC,draft=fc.quoteOfferStore.getCurrentDraft(),selection=fc.wycenaCoreSelection.normalizeQuoteSelection(draft.selection);return {selection,exact:fc.quoteSnapshotStore.listExactScopeSnapshots(fc.projectStore.getCurrentProjectId(),selection.selectedRooms,{preliminary:false}).length};});
 assert.equal(scopeProbe.exact,1,'The fresh receiver must use the original quote scope: '+JSON.stringify(scopeProbe));
 const generationBase=await image(computer);
 const keys=Object.keys(rows(await image(computer)));
 await page.evaluate(keys=>{
  const api=window.FC.applicationWrite,method=api.quote?'quote':'project',original=api[method];
  api[method]=async fn=>{const before=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));window.phoneQuoteAttempt={};
   try{const value=await original(async()=>{const value=await fn();const after=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));window.phoneQuoteAttempt={changedKeys:keys.filter(key=>before[key]!==after[key]),before,after};return value;});window.phoneQuoteAttempt.complete=true;return value;}
   catch(error){Object.assign(window.phoneQuoteAttempt,{code:error.code||error.message,stack:error.stack});throw error;}
  };
 },keys);
 await page.getByRole('button',{name:'Wyceń',exact:true}).click();await confirmQuoteSources(page);
 const naming=page.locator('.quote-scope-entry-modal--name');
 try{await naming.waitFor();}catch(error){
  const probe=await page.evaluate(()=>({attempt:window.phoneQuoteAttempt,session:{active:window.FC.session.active},generation:window.FC.wycenaTabShell._generateRuntime,notice:document.querySelector('.info-box')?.innerText,draft:window.FC.quoteOfferStore.getCurrentDraft(),policy:window.FC.projectPcvPolicy.read()}));
  fs.writeFileSync(artifacts+'/phone-variant-attempt.json',JSON.stringify(probe,null,2));
  throw Error('Variant naming not reached: '+JSON.stringify({attempt:probe.attempt&&{code:probe.attempt.code,changedKeys:probe.attempt.changedKeys,complete:probe.attempt.complete},generation:probe.generation,notice:probe.notice,draft:probe.draft,policy:probe.policy.code,active:probe.session.active}),{cause:error});
 }
 const name=await naming.locator('input').inputValue();assert.ok(name.includes('wariant 2'));
 await page.evaluate(()=>window.normalLoseQuoteAck=true);
 await naming.getByRole('button',{name:'OK',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.info-box')||!window.FC.applicationStartup.inspect().transactionPending);
 const attempt=await page.evaluate(()=>window.phoneQuoteAttempt);fs.writeFileSync(artifacts+'/phone-variant-attempt.json',JSON.stringify(attempt,null,2));
 assert.ok(!attempt?.code,'Default variant refused: '+JSON.stringify({code:attempt?.code,changedKeys:attempt?.changedKeys,notice:await page.locator('.info-box').allTextContents()}));
 const after=await image(computer),second=history(after).find(row=>row.id!==offer.id);
 assert.equal(history(after).length,2);assert.deepEqual(history(after).find(row=>row.id===offer.id),offer);
 assert.equal(second.commercial.versionName,name);assert.ok(second.totals.grand>offer.totals.grand,'The added hanging cabinet must be included in the new frozen quote');
 assert.notEqual(second.scope.sourceProjects.find(ref=>ref.projectId===pid).recordHash,offer.scope.sourceProjects.find(ref=>ref.projectId===pid).recordHash);
 assert.deepEqual(second.scope.sourceProjects.find(ref=>ref.projectId===wardrobeId),offer.scope.sourceProjects.find(ref=>ref.projectId===wardrobeId),'The untouched wardrobe keeps its exact pinned source');
 for(const key of ['fc_projects_v1','fc_investors_v1'])assert.equal(rows(after)[key],rows(generationBase)[key]);
 const added=after.outbox.filter(row=>row.scope.startsWith('p0b_quotes_')&&!generationBase.outbox.some(old=>old.key===row.key));assert.equal(added.length,1);
 await page.waitForFunction(()=>window.normalQuoteHeadCommitted===true);
 const ref=f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid),head=(await f.getDoc(ref)).data();assert.equal(head.generation,2);
 await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
 await page.evaluate(()=>{window.normalReleaseQuoteAckLoss();return true;});
 await until(async()=>(await image(computer)).outbox.find(row=>row.key===added[0].key)?.phase==='uncertain');
 await page.context().tracing.stop({path:artifacts+'/receiver-variant.zip'});await restartProbe(computer,{crash:true});page=computer.page;
 await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 await until(async()=>(await image(computer)).outbox.find(row=>row.key===added[0].key)?.phase==='verified');
 assert.deepEqual((await f.getDoc(ref)).data(),head,'Lost ACK reconciles the same revision without duplicate publication');
 assert.deepEqual(history(await image(computer)),history(after));
 await until(async()=>{const received=history(await image(phone));return received.length===2&&received.some(row=>row.id===second.id);});
 assert.deepEqual(history(await image(phone)),history(after));
 await page.context().tracing.stop({path:artifacts+'/receiver-restart.zip'});
 t.diagnostic('Fresh receiver defaults, real hanging cabinet draft/Save, named variant, immutable first offer, real IDB/outbox/ACK and restart preserved');
 }catch(error){
  await page.screenshot({path:artifacts+'/receiver-failure.png',fullPage:true}).catch(()=>{});
  await page.context().tracing.stop({path:artifacts+'/receiver-failure.zip'}).catch(()=>{});throw error;
 }
}
