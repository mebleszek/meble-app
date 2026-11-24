import assert from 'node:assert/strict';
import {waitForApplicationIdle} from './quote-ui-actions.mjs';

// Part of the existing signed startup/quote case, not a second CI job.
export async function quoteRouteRequestCase({t,phone,computer,iid,pid,image,rows,until,db,ownerUid,artifacts,firestore:f}){
 const page=phone.page;
 await page.locator('[data-action="tab"][data-tab="wycena"]').click();
 await waitForApplicationIdle(page);
 const before=await image(phone),originalDraft=await page.evaluate(()=>window.FC.quoteOfferStore.getCurrentDraft());
 const contactBefore=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();
 await page.evaluate(async iid=>{await window.FC.applicationWrite.auto(()=>window.FC.investorPersistence.saveInvestorPatch(iid,{transport:{distanceKm:'12',durationMin:'',status:'manual',source:'ręcznie'}}));},iid);
 await until(async()=>JSON.parse((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data().contact).transport.durationMin==='');
 const missing=await image(phone),history=rows(missing).fc_quote_snapshots_v1;
 const button=()=>page.locator('[data-action="wycena-generate"]');
 const choice=action=>page.locator('[data-quote-route="'+action+'"]');
 const done=async()=>{await page.waitForFunction(()=>!document.querySelector('[data-action="wycena-generate"]')?.disabled);await waitForApplicationIdle(page);};
 await button().click();await choice('cancel').waitFor();await page.screenshot({path:artifacts+'/quote-route-request.png'});await choice('cancel').click();await done();
 assert.equal(rows(await image(phone)).fc_quote_snapshots_v1,history);
 assert.equal(rows(await image(phone)).fc_investors_v1,rows(missing).fc_investors_v1,'Cancel has no investor write');
 await button().click();await choice('investor').click();
 await page.waitForFunction(()=>window.uiState.activeTab==='inwestor');await waitForApplicationIdle(page);
 assert.equal(rows(await image(phone)).fc_quote_snapshots_v1,history);
 await page.locator('[data-action="tab"][data-tab="wycena"]').click();await done();
 assert.equal(await choice('save').count(),0,'Returning to WYCENA cannot restart the cancelled calculation');

 // The same real modal can commit pickup settings independently of generation.
 await page.evaluate(()=>{window.routePreparation=window.FC.quoteRouteRequest.prepare(()=>window.FC.quoteOfferStore.getCurrentDraft());});
 await choice('pickup').click();assert.equal(await page.evaluate(()=>window.routePreparation),true);await waitForApplicationIdle(page);
 const pickup=await page.evaluate(()=>window.FC.quoteOfferStore.getCurrentDraft());
 assert.deepEqual(pickup.services,{delivery:false,carrying:false,assembly:false});
 assert.deepEqual(pickup.selection,originalDraft.selection);assert.deepEqual(pickup.commercial,originalDraft.commercial);
 assert.equal(rows(await image(phone)).fc_investors_v1,rows(missing).fc_investors_v1);
 await page.evaluate(async()=>{const api=window.FC.quoteOfferStore,draft=api.getCurrentDraft();await api.saveSettings(draft,{services:{delivery:true,carrying:true,assembly:true}});});
 await waitForApplicationIdle(page);

 // Abort the native atomic checkpoint: no contact/outbox/history partial write.
 const beforeAbort=await image(phone);
 await button().click();await choice('distanceKm').fill('12');await choice('durationMin').fill('30');
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(row,...args){const result=put.call(this,row,...args);if(this.name==='control'&&row.key==='application'){IDBObjectStore.prototype.put=put;window.routeAbortObserved=true;queueMicrotask(()=>this.transaction.abort());}return result;};});
 await choice('save').click();await page.locator('.info-box').waitFor();
 assert.equal(await page.evaluate(()=>window.routeAbortObserved),true);
 assert.equal(rows(await image(phone)).fc_investors_v1,rows(beforeAbort).fc_investors_v1);
 assert.equal(rows(await image(phone)).fc_quote_snapshots_v1,history);
 await page.locator('.info-box button').click();await done();
 const remoteAfterAbort=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();
 assert.equal(JSON.parse(remoteAfterAbort.contact).transport.durationMin,'');
 assert.ok(remoteAfterAbort.contactRevision>contactBefore.contactRevision);

 await button().click();await choice('distanceKm').fill('-1');await choice('durationMin').fill('30');await choice('save').click();
 assert.match(await page.locator('.quote-scope-entry-modal [role="alert"]').innerText(),/nie mniejsze od zera/);
 assert.equal(rows(await image(phone)).fc_quote_snapshots_v1,history);
 await choice('distanceKm').fill('12');await choice('cancel').click();await done();

 // A peer contact update while the dialog is open must not be overwritten.
 await button().click();await choice('durationMin').fill('30');
 await computer.page.evaluate(async iid=>{await window.FC.applicationWrite.auto(()=>window.FC.investorPersistence.saveInvestorPatch(iid,{notes:'Peer contact retained'}));},iid);
 await until(async()=>JSON.parse(rows(await image(phone)).fc_investors_v1).find(row=>row.id===iid)?.notes==='Peer contact retained');
 await choice('save').click();await page.locator('.info-box').waitFor();
 assert.match(await page.locator('.info-box').innerText(),/TRANSPORT_CONTEXT_CHANGED/);
 assert.equal(JSON.parse(rows(await image(phone)).fc_investors_v1).find(row=>row.id===iid).transport.durationMin,'');
 assert.equal(rows(await image(phone)).fc_quote_snapshots_v1,history);
 await page.locator('.info-box button').click();await done();

 // Preserve all room records and globals; the following ordinary Calculate
 // performs the successful manual save and the existing ACK/SIGKILL proof.
 assert.equal(rows(await image(phone)).fc_projects_v1,rows(before).fc_projects_v1);
 assert.equal(rows(await image(phone)).fc_company_profile_v1,rows(before).fc_company_profile_v1);
 await until(async()=>JSON.parse(rows(await image(computer)).fc_investors_v1).find(row=>row.id===iid)?.transport.durationMin==='');
 t.diagnostic('Route request real UI: cancel, stopped investor navigation, pickup settings, invalid input and aborted native contact checkpoint preserve history/rooms/globals');
 return async()=>{
  await choice('distanceKm').fill('12');await choice('durationMin').fill('30');await choice('save').click();
  await until(async()=>JSON.parse((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data().contact).transport.durationMin==='30');
  await until(async()=>JSON.parse(rows(await image(computer)).fc_investors_v1).find(row=>row.id===iid)?.transport.durationMin==='30');
  assert.equal(await page.evaluate(()=>window.FC.investorTransport.getCurrentTransportContext().billableKm),24);
 };
}
