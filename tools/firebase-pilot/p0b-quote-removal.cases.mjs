import {confirmQuoteSources} from './quote-ui-actions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function quoteRemovalCase({t,phone,computer,offer,iid,pid,wardrobeId,image,rows,until,restartProbe,artifacts,showList}){
 let page=phone.page;
 const idle=()=>page.waitForFunction(()=>{const r=window.FC.wycenaTabShell._generateRuntime,n=Date.now();return !r.inFlight&&n-r.lastAcceptedAt>=1500&&n-r.lastReleasedAt>=1200&&!window.FC.applicationStartup.inspect().transactionPending;});
 await until(async()=>(await image(phone)).outbox.every(op=>op.phase==='verified'));
 await idle();await page.getByRole('button',{name:'Wyceń',exact:true}).click();await confirmQuoteSources(page);
 await page.getByRole('button',{name:'Zamień istniejącą',exact:true}).click();
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);await idle();
 if(offer.scope.selectedRooms.includes(wardrobeId)){
  await until(async()=>(await image(phone)).outbox.every(op=>op.phase==='verified'));
  const held=await image(phone),peer=await image(computer);
  await page.evaluate(()=>{const api=window.FC.applicationWrite,run=api.quoteRemoval;api.quoteRemoval=async(...args)=>{try{return await run(...args);}catch(error){window.removalConflict=error.code;throw error;}};});
  await page.locator('[data-quote-history-id="'+offer.id+'"] .btn-danger').click();await page.getByRole('button',{name:'Usuń ofertę',exact:true}).click();
  await page.locator('.info-box').waitFor();await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
  assert.equal(await page.evaluate(()=>window.removalConflict),'LF_QUOTE_EDITOR_BUSY','A foreign room editor must refuse the entire removal before any local change');
  assert.deepEqual(rows(await image(phone)),rows(held));assert.deepEqual((await image(phone)).outbox,held.outbox);
  assert.deepEqual(rows(await image(computer)),rows(peer));await page.locator('.info-box .is-success').click();
 }
 await showList(computer.page);await until(async()=>!(await image(computer)).replicas.find(r=>r.key===wardrobeId).editor?.active);
 await until(async()=>(await image(phone)).outbox.every(op=>op.phase==='verified'));
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending);
 const before=await image(phone);assert.equal(JSON.parse(rows(before).fc_quote_snapshots_v1).length,1);
 const remove=()=>page.locator('[data-quote-history-id="'+offer.id+'"] .btn-danger');
 await remove().click();await page.getByRole('button',{name:'Wróć',exact:true}).click();
 assert.deepEqual(rows(await image(phone)),rows(before),'Cancel must not remove history or statuses');
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){const request=original.call(this,value,...args);if(this.name==='control'&&value?.key==='application'&&JSON.parse(value.rows.fc_quote_snapshots_v1||'[]').length===0){IDBObjectStore.prototype.put=original;window.removalAbortObserved=true;queueMicrotask(()=>this.transaction.abort());}return request;};});
 await remove().click();await page.getByRole('button',{name:'Usuń ofertę',exact:true}).click();
 await page.locator('.info-box').waitFor();await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 // On BASE, status preparation may refuse before reaching IDB. Both outcomes
 // preserve data; only the corrected path must prove the injected abort ran.
 const aborted=await image(phone);assert.deepEqual(rows(aborted),rows(before));assert.deepEqual(aborted.outbox,before.outbox);
 await page.locator('.info-box .is-success').click();
 await page.evaluate(()=>{delete window.removalError;});
 await page.evaluate(()=>{
  const api=window.FC.applicationWrite;for(const key of ['project','quoteRemoval'])if(api[key]){const run=api[key];api[key]=async(...args)=>{try{return await run(...args);}catch(e){window.removalError={code:e.code||e.message,stack:e.stack};throw e;}};}
  window.removalProjectBefore=JSON.stringify(window.projectData);
 });
 await remove().click();await page.getByRole('button',{name:'Usuń ofertę',exact:true}).click();
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 const deletion=await page.evaluate(id=>({error:window.removalError,present:!!window.FC.quoteSnapshotStore.getById(id),ramChanged:window.removalProjectBefore!==JSON.stringify(window.projectData)}),offer.id);
 if(deletion.present){
  if(await page.locator('.info-box').isVisible())await page.locator('.info-box .is-success').click();
  await idle();await page.getByRole('button',{name:'Wyceń',exact:true}).click();await confirmQuoteSources(page);
  await page.waitForFunction(()=>document.querySelector('.info-box')||document.querySelector('.confirm-box'));
  const notice=await page.locator('.info-box').allTextContents();
  if(await page.locator('.info-box').isVisible())await page.locator('.info-box .is-success').click();else await page.getByRole('button',{name:'Anuluj',exact:true}).click();
  await page.locator('[data-action="tab"][data-tab="material"]').click();
  const pcv=await page.evaluate(()=>{const fc=window.FC,record=fc.projectStore.getCurrentRecord(),clean=x=>fc.projectStore.prepareProjectDataForPersistence(x),a=clean(window.projectData),b=clean(record.projectData),paths=[];function diff(x,y,p){if(JSON.stringify(x)===JSON.stringify(y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'){for(const k of new Set([...Object.keys(x),...Object.keys(y)]))diff(x[k],y[k],p+'.'+k);}else paths.push(p);}diff(a,b,'projectData');return {policy:fc.projectPcvPolicy.read(),paths};});
  fs.writeFileSync(artifacts+'/removal.json',JSON.stringify({deletion,notice,pcv},null,2));t.diagnostic('Removal evidence '+JSON.stringify({deletion,notice,pcvPaths:pcv.paths,pcvCode:pcv.policy.code}));
 }
 assert.equal(deletion.present,false,'Confirmed offer deletion must commit: '+JSON.stringify(deletion));
 assert.equal(await page.evaluate(()=>window.removalAbortObserved),true,'The rollback test must reach and abort the actual IDB commit');
 const removed=await image(phone);assert.deepEqual(JSON.parse(rows(removed).fc_quote_snapshots_v1),[]);
 for(const old of before.protected)assert.deepEqual(removed.protected.find(row=>row.key===old.key),old);
 await until(async()=>(await image(phone)).outbox.every(op=>op.phase==='verified'));
 await until(async()=>JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1||'[]').length===0);
 await idle();await page.getByRole('button',{name:'Wyceń',exact:true}).click();await confirmQuoteSources(page);
 await page.waitForFunction(()=>document.querySelector('[data-quote-history-id]')||document.querySelector('.info-box'));
 assert.equal(await page.locator('.info-box').count(),0,'Recalculation after deletion must preserve verified sources');
 const recalculated=JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1);assert.equal(recalculated.length,1);assert.notEqual(recalculated[0].id,offer.id);assert.deepEqual(recalculated[0].totals,offer.totals);
 assert.deepEqual(recalculated[0].scope.selectedRooms,offer.scope.selectedRooms);
 for(const tab of ['material','czynnosci','wycena']){
  await page.locator('[data-action="tab"][data-tab="'+tab+'"]').click();
  if(await page.locator('.confirm-box').isVisible())await page.getByRole('button',{name:'Zapisz i przejdź',exact:true}).click();
  await page.waitForFunction(tab=>window.uiState.activeTab===tab&&!window.FC.applicationStartup.inspect().transactionPending,tab);
  const policy=await page.evaluate(()=>{const r=window.FC.projectPcvPolicy.read();return {ok:r.ok,code:r.code};});assert.equal(policy.ok,true,tab+' '+JSON.stringify(policy));
  assert.equal((await page.locator('body').innerText()).includes('RAM_DIVERGENCE'),false);
 }
 await until(async()=>(await image(phone)).outbox.every(op=>op.phase==='verified'));
 await page.context().tracing.stop({path:artifacts+'/removal-before-restart.zip'});await restartProbe(phone,{crash:true});page=phone.page;
 await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 assert.equal(JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1).some(row=>row.id===offer.id),false);
 assert.deepEqual(JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1),recalculated);
 t.diagnostic('Duplicate/removal: cancel and real IDB abort preserve all data; explicit retry, immutable prior images, ACK/peer, recalculation, Material/Actions/tabs, PCV and restart pass');
}
