import {confirmQuoteSources,waitForApplicationIdle} from './quote-ui-actions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as f from 'firebase/firestore';

const wycena='[data-action="tab"][data-tab="wycena"]';
const quoteRows=(rows,value)=>JSON.parse(rows(value).fc_quote_snapshots_v1||'[]');

async function generateVariant(page,name,discount,{first=false}={}){
 await waitForApplicationIdle(page);
 const field=label=>page.locator('.quote-offer-field').filter({has:page.getByText(label,{exact:true})}).locator('input');
 const amount=field('Rabat kwotowy');
 if(!await amount.isVisible())await page.locator('.quote-offer-accordion__trigger').click();
 await amount.fill(String(discount));await amount.blur();
 await page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());
 if(first){
  const version=field('Nazwa wersji oferty');await version.fill(name);await version.blur();
  await page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());
 }
 await page.locator('[data-action="wycena-generate"]').click();await confirmQuoteSources(page);
 if(!first){
  const naming=page.locator('.quote-scope-entry-modal--name');
  await naming.locator('input').fill(name);await naming.getByRole('button',{name:'OK',exact:true}).click();
 }
 const item=page.locator('[data-quote-history-id]').filter({has:page.getByText(name,{exact:true})});
 await item.waitFor();
 return item.getAttribute('data-quote-history-id');
}

export async function variantsCase(c){
 const {t,phone,computer,offer,iid,pid,db,ownerUid,until,image,rows,restartProbe,artifacts,globalBefore,env}=c;
 const page=phone.page,scope=(await image(phone)).outbox.find(op=>op.scope.startsWith('p0b_quotes_')).scope;
 await until(async()=>(await image(phone)).outbox.find(op=>op.scope===scope)?.phase==='verified');
 const first=await image(phone),firstLedger=JSON.parse(first.replicas.find(row=>row.key===scope).json);
 const peer=computer.page;
 await until(async()=>JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1||'[]').some(row=>row.id===offer.id));
 await waitForApplicationIdle(peer);
 await peer.locator(wycena).click();
 const historyItem=(id)=>peer.locator('[data-quote-history-id="'+id+'"]');
 await historyItem(offer.id).waitFor();
 const workingName='P0-B robocza nazwa odbiorcy';
 const version=peer.locator('.quote-offer-field').filter({has:peer.getByText('Nazwa wersji oferty',{exact:true})}).locator('input');
 if(!await version.isVisible())await peer.locator('.quote-offer-accordion__trigger').click();
 await version.fill(workingName);await version.blur();
 assert.equal(await peer.evaluate(()=>window.FC.quoteOfferStore.settingsSettled()),true);
 await waitForApplicationIdle(peer);
 const receiverBefore=await peer.evaluate(()=>{
  const root=document.getElementById('quoteActivePreview');
  window.normalOpenQuote={root,preview:root.querySelector('#quotePreviewStart'),entry:window.uiState.entry,tab:window.uiState.activeTab,timeOrigin:performance.timeOrigin};
  document.getElementById('quoteHistorySection').scrollIntoView({block:'center',behavior:'instant'});
  return {top:window.scrollY,draft:window.FC.quoteOfferStore.getCurrentDraft()};
 });
 assert.equal(receiverBefore.draft.commercial.versionName,workingName);
 const peerDraft=rows(await image(computer)).fc_quote_offer_drafts_v1;
 // Only explicit synthetic commercial inputs differ, never a price list/rule.
 const amount=page.locator('.quote-offer-field').filter({has:page.getByText('Rabat kwotowy',{exact:true})}).locator('input');
 if(!await amount.isVisible())await page.locator('.quote-offer-accordion__trigger').click();
 await amount.fill('1');await amount.blur();await page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());
 const before=await image(phone),keys=Object.keys(rows(before));
 await page.evaluate(keys=>{
  const writer=window.FC.applicationWrite,method=writer.quote?'quote':'project',original=writer[method];
  writer[method]=async fn=>{
   const previous=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
   window.normalVariantAttempt={};
   try{return await original(async()=>{
    const result=await fn(),next=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
    const changedKeys=keys.filter(key=>previous[key]!==next[key]);
    window.normalVariantAttempt={changedKeys,before:previous,after:next};
    return result;
   });}catch(error){Object.assign(window.normalVariantAttempt,{code:error.code||error.message,stack:error.stack});throw error;}
  };
  window.normalLoseQuoteAck=true;
 },keys);
 await page.locator('[data-action="wycena-generate"]').click();await confirmQuoteSources(page);
 const naming=page.locator('.quote-scope-entry-modal--name');await naming.waitFor();
 await naming.locator('input').fill('P0-B drugi wariant DEMO');
 await naming.getByRole('button',{name:'OK',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.info-box')||!window.FC.applicationStartup.inspect().transactionPending);
 const attempted=await page.evaluate(()=>window.normalVariantAttempt);
 fs.writeFileSync(path.join(artifacts,'variant-attempt.json'),JSON.stringify(attempted,null,2));
 if(attempted?.code)t.diagnostic('First variant refusal: '+JSON.stringify({code:attempted.code,changedKeys:attempted.changedKeys,stack:attempted.stack}));
 const notice=await page.locator('.info-box').allTextContents();
 assert.ok(!attempted?.code,'Variant must commit: '+JSON.stringify({notice,code:attempted?.code,changedKeys:attempted?.changedKeys,stack:attempted?.stack}));
 const after=await image(phone),history=JSON.parse(rows(after).fc_quote_snapshots_v1),second=history.find(row=>row.id!==offer.id);
 assert.equal(history.length,2);assert.ok(second);assert.notEqual(second.id,offer.id);
 assert.deepEqual(history.find(row=>row.id===offer.id),offer,'The first frozen snapshot must remain exactly unchanged');
 assert.equal(second.investor.id,iid);assert.equal(second.project.id,pid);
 assert.equal(second.commercial.versionName,'P0-B drugi wariant DEMO');assert.equal(second.commercial.discountAmount,1);
 assert.ok(Math.abs(second.totals.grand-offer.totals.grand+1)<1e-8,'Only the explicit one-unit discount changes the total');
 assert.deepEqual(second.scope,offer.scope,'Source identities, hashes and pinned revisions stay the same');
 const ledger=JSON.parse(after.replicas.find(row=>row.key===scope).json);
 assert.deepEqual(ledger.pins[offer.id],firstLedger.pins[offer.id]);assert.deepEqual(ledger.pins[second.id],firstLedger.pins[offer.id]);
 for(const key of ['fc_projects_v1','fc_investors_v1'])assert.equal(rows(after)[key],rows(before)[key]);
 const unrelated=Object.keys(rows(before)).filter(key=>!['fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_ui_v1'].includes(key));
 for(const key of unrelated)assert.equal(rows(after)[key],rows(before)[key],key+' must remain unchanged');
 const added=after.outbox.filter(op=>!before.outbox.some(prior=>prior.key===op.key));assert.equal(added.length,1);assert.equal(added[0].scope,scope);
 await page.waitForFunction(()=>window.normalQuoteHeadCommitted===true);
 const ref=f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid),head=(await f.getDoc(ref)).data();assert.equal(head.generation,2);
 await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
 await page.evaluate(()=>{window.normalReleaseQuoteAckLoss();return true;});
 await until(async()=>(await image(phone)).outbox.find(op=>op.key===added[0].key)?.phase==='uncertain');
 await page.context().tracing.stop({path:path.join(artifacts,'variant-before-restart.zip')});
 await restartProbe(phone,{crash:true});
 await until(async()=>(await image(phone)).outbox.find(op=>op.key===added[0].key)?.phase==='verified');
 const restarted=await image(phone);assert.deepEqual(JSON.parse(rows(restarted).fc_quote_snapshots_v1),history);
 assert.equal(restarted.outbox.filter(op=>op.scope===scope).length,2);
 assert.deepEqual((await f.getDoc(ref)).data(),head,'Reconcile the same ACK without a duplicate publication');
 const draft=JSON.parse(rows(restarted).fc_quote_offer_drafts_v1).find(row=>row.projectId===pid);
 assert.equal(draft.commercial.versionName,second.commercial.versionName);
 await until(async()=>JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1||'[]').length===2);
 const receiver=await image(computer),received=JSON.parse(rows(receiver).fc_quote_snapshots_v1);
 const verified=restarted.outbox.find(op=>op.key===added[0].key);
 const replica=receiver.replicas.find(row=>row.key===scope);
 assert.equal(verified.phase,'verified');
 assert.deepEqual(JSON.parse(verified.json).offers.find(row=>row.id===second.id),second);
 assert.equal(replica.hash,verified.hash);
 assert.equal(replica.dirty,false);
 assert.deepEqual(JSON.parse(replica.json).offers.find(row=>row.id===second.id),second);
 assert.deepEqual(received,history);
 assert.equal(rows(receiver).fc_quote_offer_drafts_v1,peerDraft,'Remote receipt cannot rewrite the receiver draft');
 await waitForApplicationIdle(peer);
 const visible=await historyItem(second.id).isVisible();
 t.diagnostic('Open history receipt: '+JSON.stringify({offerId:second.id,senderPhase:verified.phase,
  replica:replica.base.currentRevisionId||replica.base.revisionId,replicaContainsOffer:true,localHistoryContainsOffer:true,visible}));
 await peer.screenshot({path:path.join(artifacts,visible?'open-history-green.png':'open-history-red.png')});
 assert.equal(visible,true,'A verified quote in the replica and durable history must appear in the already-open WYCENA');
 const receiverAfter=await peer.evaluate(()=>{
  const before=window.normalOpenQuote,root=document.getElementById('quoteActivePreview');
  return {sameRoot:root===before.root,samePreview:root.querySelector('#quotePreviewStart')===before.preview,
   samePage:performance.timeOrigin===before.timeOrigin,sameView:window.uiState.entry===before.entry&&window.uiState.activeTab===before.tab,
   active:root.querySelector('[data-quote-history-id].is-active')?.dataset.quoteHistoryId,
   top:window.scrollY,draft:window.FC.quoteOfferStore.getCurrentDraft()};
 });
 assert.deepEqual(receiverAfter,{...receiverBefore,sameRoot:true,samePreview:true,samePage:true,sameView:true,active:offer.id});
 await env.withSecurityRulesDisabled(async context=>assert.equal((await f.getDocs(f.collection(context.firestore(),'users',ownerUid,'p0bRoomQuotes',iid,'revisions'))).size,2));
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 t.diagnostic('Two real UI variants: immutable first snapshot/pins, exact second values, one atomic ledger/draft commit, SIGKILL and ACK without duplicates');
 await guardedReceipts(c,{history,scope});
}

async function guardedReceipts(c,{history,scope}){
 const {t,phone,computer,offer,iid,pid,image,rows,until,login,createInvestor,addRoom,openRoom,addCabinet,saveProject,showList,db,ownerUid,globalBefore}=c;
 const author=phone.page,peer=computer.page;
 const readHistory=async()=>quoteRows(rows,await image(computer));
 const waitForId=id=>until(async()=>(await readHistory()).some(row=>row.id===id));
 const visible=id=>peer.locator('[data-quote-history-id="'+id+'"]').waitFor();
 const blocked=code=>peer.waitForFunction(code=>window.FC.applicationStartup.inspect().states?.some(s=>s.code===code),code);
 async function verified(id,expectedScope){
  const matches=ops=>ops.some(op=>(!expectedScope||op.scope===expectedScope)&&op.scope.startsWith('p0b_quotes_')
    &&op.phase==='verified'&&JSON.parse(op.json).offers.some(row=>row.id===id));
  await until(async()=>matches((await image(phone)).outbox));
 }

 // A real open picker prevents remote application; closing it must resume
 // the watch and update the very same WYCENA screen on the original document.
 await openRoom(phone,pid);await waitForApplicationIdle(author);await author.locator(wycena).click();
 await peer.locator('.quote-selection-launch--rooms').click();
 const picker=peer.locator('.panel-box-backdrop');
 await picker.locator('label').first().click();
 const pickerState=()=>picker.locator('input').evaluateAll(inputs=>inputs.map(input=>input.checked));
 const checked=await pickerState();
 const formId=await generateVariant(author,'P0-B wariant podczas formularza',2);
 await verified(formId,scope);await blocked('LF_ACTIVE_FORM_PROTECTED');
 assert.deepEqual(await readHistory(),history);
 assert.deepEqual(await pickerState(),checked,'Remote receipt must preserve the open picker');
 assert.equal(await peer.locator('[data-quote-history-id="'+formId+'"]').count(),0);
 await picker.locator('.panel-box__close').click();
 await peer.getByRole('button',{name:'✕ ANULUJ ZMIANY',exact:true}).click();
 await picker.waitFor({state:'hidden'});
 await waitForId(formId);await visible(formId);
 assert.equal(await peer.evaluate(()=>document.getElementById('quoteActivePreview')===window.normalOpenQuote.root),true);
 t.diagnostic('Open form fenced remote offer '+formId+' until close, then refreshed the same quote tab');

 // Keep the same page and receive another offer during the next authorization.
 await waitForApplicationIdle(peer);
 const previewId=history.find(row=>row.id!==offer.id).id;
 await peer.locator('[data-quote-history-id="'+previewId+'"]').getByRole('button',{name:'Podgląd',exact:true}).click();
 await peer.locator('#main-signout').click();
 await peer.locator('#auth-google').waitFor();
 await peer.waitForFunction(()=>window.FC.applicationStartup.inspect().state==='locked');
 const loginId=await generateVariant(author,'P0-B wariant podczas wylogowania',3);
 await verified(loginId,scope);
 assert.equal((await readHistory()).some(row=>row.id===loginId),false);
 await login(computer);
 await waitForId(loginId);await visible(loginId);
 assert.equal(await peer.evaluate(()=>performance.timeOrigin===window.normalOpenQuote.timeOrigin&&window.uiState.activeTab==='wycena'),true);
 assert.equal(await peer.locator('[data-quote-history-id].is-active').getAttribute('data-quote-history-id'),previewId);
 t.diagnostic('Same-tab reauthorization refreshed offer '+loginId+' and retained the earlier preview');

 // The regular edit/save path keeps the protected IndexedDB draft intact and
 // only allows reception after the safe end of editing.
 await peer.locator('[data-action="tab"][data-tab="wywiad"]').click();
 await addCabinet(computer,83);
 const draft=await image(computer),draftRows=rows(draft);
 assert.equal(JSON.parse(draftRows.fc_edit_session_v1).active,true);
 const editId=await generateVariant(author,'P0-B wariant podczas edycji',4);
 await verified(editId,scope);await blocked('LF_ACTIVE_RAM_PROTECTED');
 const held=rows(await image(computer));
 for(const key of ['fc_edit_session_v1','fc_projects_v1','fc_quote_snapshots_v1'])assert.equal(held[key],draftRows[key],key+' must survive the protected receive');
 await saveProject(peer,{flush:false});
 await waitForId(editId);
 await waitForApplicationIdle(peer);await peer.locator(wycena).click();await visible(editId);
 t.diagnostic('Unsaved cabinet edit deferred offer '+editId+' until a verified local Save');

 // Receive a later offer for a different investor without rebuilding the
 // currently visible list or moving its selection or working settings.
 const current=await peer.evaluate(()=>{
  window.normalInvestorHistory=document.getElementById('quoteHistorySection');
  return window.normalInvestorHistory.textContent;
 });
 const foreignName='P0-B inny inwestor';
 await createInvestor(author,{name:foreignName,phone:'123456788',email:'p0b-other@example.invalid',address:'Synthetic 2'});
 const foreignInvestor=JSON.parse(rows(await image(phone)).fc_investors_v1).find(row=>row.name===foreignName);
 assert.ok(foreignInvestor);
 await until(async()=>(await image(phone)).outbox.some(op=>op.scope.startsWith('p0b_contact_')
  &&op.phase==='verified'&&JSON.parse(op.json).investorId===foreignInvestor.id));
 const foreignRoom=await addRoom(phone,'P0B foreign kitchen');
 await until(async()=>(await image(phone)).outbox.some(op=>op.scope===foreignRoom.id&&op.phase==='verified'));
 await waitForApplicationIdle(author);
 if(!await author.evaluate(id=>window.FC.session.active&&window.FC.session.projectId===id,foreignRoom.id))await openRoom(phone,foreignRoom.id);
 await author.waitForFunction(id=>window.FC.session.active&&window.FC.session.projectId===id,foreignRoom.id);
 // Prepare confirmed source data on the author only. The receiver stays in WYCENA.
 await addCabinet(phone,57);await saveProject(author);
 await until(async()=>(await image(phone)).outbox.filter(op=>op.scope===foreignRoom.id).every(op=>op.phase==='verified'));
 await author.locator(wycena).click();
 const foreignId=await generateVariant(author,'P0-B oferta innego inwestora',5,{first:true});
 await verified(foreignId);await waitForId(foreignId);await waitForApplicationIdle(peer);
 const received=await readHistory();
 assert.notEqual(received.find(row=>row.id===foreignId).investor.id,iid);
 assert.deepEqual(await peer.evaluate(()=>({same:document.getElementById('quoteHistorySection')===window.normalInvestorHistory,
  text:document.getElementById('quoteHistorySection').textContent})),{same:true,text:current});
 assert.equal(await peer.locator('[data-quote-history-id="'+foreignId+'"]').count(),0);
 for(const row of history)assert.deepEqual(received.find(candidate=>candidate.id===row.id),row);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 await showList(author);await showList(peer);
 t.diagnostic('Foreign offer '+foreignId+' was received with the open investor history and original prices unchanged');
}
