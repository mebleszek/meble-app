import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as f from 'firebase/firestore';
export async function tabSaveCase({t,computer,wardrobeId,image,rows,openRoom,addCabinet,restartProbe}){
 const page=computer.page,before=await image(computer);
 await page.locator('[data-action="tab"][data-tab="wycena"]').filter({visible:true}).first().click();
 const choice=page.locator('.confirm-box');await choice.waitFor();
 await choice.getByRole('button',{name:'Zapisz i przejdź',exact:true}).click();
 try{await page.waitForFunction(()=>window.uiState.activeTab==='wycena'&&!window.FC.applicationStartup.inspect().transactionPending,{},{timeout:10000});}
 catch(error){throw Error('Tab save failed: '+await page.locator('body').innerText());}
 const after=await image(computer),record=JSON.parse(rows(after).fc_projects_v1).find(row=>row.id===wardrobeId);
 assert.equal(record.projectData[wardrobeId].cabinets.length,1);
 assert.ok(after.outbox.some(op=>op.scope===wardrobeId&&!before.outbox.some(old=>old.key===op.key)));
 assert.equal(await page.evaluate(()=>window.FC.session.active),false);
 t.diagnostic('Real Save and proceed confirmed the room in IndexedDB and queued its publication before changing tabs');
 await page.locator('[data-action="tab"][data-tab="inwestor"]').filter({visible:true}).first().click();
 await page.waitForFunction(()=>window.uiState.activeTab==='inwestor'&&!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending);
 await openRoom(computer,wardrobeId);await page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending);
 await addCabinet(computer,88);const draft=await image(computer);
 assert.equal(await page.locator('.cab-actions [data-act="edit"]').first().isVisible(),true,'The edit view must be visible before the aborted transition');
 await page.evaluate(()=>{const api=window.FC.cabinetsRender,original=api.renderCabinets;window.normalTabRenders=[];api.renderCabinets=function(...args){window.normalTabRenders.push({tab:window.uiState.activeTab,stack:new Error().stack.split('\n').slice(1,7)});return original.apply(this,args);};});
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){const request=original.call(this,value,...args);if(this.name==='control'&&value?.key==='application'){IDBObjectStore.prototype.put=original;queueMicrotask(()=>this.transaction.abort());}return request;};});
 await page.locator('[data-action="tab"][data-tab="wycena"]').filter({visible:true}).first().click();
 await page.locator('.confirm-box').getByRole('button',{name:'Zapisz i przejdź',exact:true}).click();
 await page.locator('.info-box').waitFor();await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 const aborted=await image(computer);assert.deepEqual(rows(aborted),rows(draft));assert.deepEqual(aborted.outbox,draft.outbox);
 assert.equal(await page.evaluate(()=>window.FC.session.active),true);assert.equal(await page.evaluate(()=>window.uiState.activeTab),'wywiad');
 assert.equal(await page.locator('.cab-actions [data-act="edit"]').first().isVisible(),true,'Aborted navigation must also restore the visible edit view: '+JSON.stringify(await page.evaluate(()=>window.normalTabRenders)));
 await page.locator('.info-box .is-success').click();await page.context().setOffline(true);
 await page.locator('[data-action="tab"][data-tab="wycena"]').filter({visible:true}).first().click();
 await page.locator('.confirm-box').getByRole('button',{name:'Zapisz i przejdź',exact:true}).click();
 await page.waitForFunction(()=>window.uiState.activeTab==='wycena'&&!window.FC.applicationStartup.inspect().transactionPending);
 const offline=await image(computer),queued=offline.outbox.find(op=>op.scope===wardrobeId&&op.phase==='queued');assert.ok(queued);
 assert.equal(JSON.parse(rows(offline).fc_projects_v1).find(row=>row.id===wardrobeId).projectData[wardrobeId].cabinets.length,2);
 await restartProbe(computer,{crash:true});const recovered=await image(computer);
 assert.equal(JSON.parse(rows(recovered).fc_projects_v1).find(row=>row.id===wardrobeId).projectData[wardrobeId].cabinets.length,2);
 assert.ok(recovered.outbox.find(op=>op.key===queued.key));
 t.diagnostic('Tab Save: forced IDB abort preserves the draft/view/outbox, explicit retry works offline and data survives SIGKILL/restart');
}
export async function duplicateCase({t,phone,computer,offer,iid,until,image,rows,artifacts,db,ownerUid,restartProbe,globalBefore}){
 const page=phone.page;
 await until(async()=>(await image(phone)).outbox.filter(op=>op.scope.startsWith('p0b_quotes_')).every(op=>op.phase==='verified'));
 const before=await image(phone),scope=before.outbox.find(op=>op.scope.startsWith('p0b_quotes_')).scope;
 const ref=f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid),headBefore=(await f.getDoc(ref)).data();
 const oldRevisionRef=f.doc(ref,'revisions',headBefore.revisionId),oldRevision=(await f.getDoc(oldRevisionRef)).data();
 await page.evaluate(()=>{window.normalQuoteHeadCommitted=false;window.normalLoseQuoteAck=true;});
 await page.evaluate(()=>{
  const api=window.FC.applicationWrite,original=api.project;
  api.project=async function(fn){const before=JSON.parse(localStorage.getItem('fc_quote_snapshots_v1'));
   try{return await original.call(this,async()=>{const result=await fn();const after=JSON.parse(localStorage.getItem('fc_quote_snapshots_v1'));
    const paths=[];function diff(a,b,p){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[key],b[key],p+'.'+key);}else paths.push(p);}
    diff(before,after,'offers');window.normalDuplicateChange=paths;return result;});}
   catch(error){window.normalDuplicateError={code:error.code||error.message,stack:error.stack};throw error;}
   finally{api.project=original;}
  };
 });
 await page.getByRole('button',{name:'Wyceń',exact:true}).click();
 await page.locator('.confirm-box').getByRole('button',{name:'Zamień istniejącą',exact:true}).click();
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 const evidence=await page.evaluate(()=>({error:window.normalDuplicateError,paths:window.normalDuplicateChange}));
 fs.writeFileSync(path.join(artifacts,'duplicate.json'),JSON.stringify(evidence,null,2));
 assert.ok(!evidence.error,JSON.stringify(evidence));
 const history=JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1);
 assert.equal(history.length,1);assert.equal(history[0].id,offer.id);assert.deepEqual(history[0].totals,offer.totals);
 assert.deepEqual(history[0].scope,offer.scope);assert.deepEqual(history[0].commercial,offer.commercial);
 const after=await image(phone),added=after.outbox.filter(op=>!before.outbox.some(old=>old.key===op.key));assert.equal(added.length,1);assert.equal(added[0].scope,scope);
 for(const key of ['fc_projects_v1','fc_investors_v1'])assert.equal(rows(after)[key],rows(before)[key]);
 for(const old of before.protected)assert.deepEqual(after.protected.find(row=>row.key===old.key),old,'Old protected snapshots cannot change');
 await page.waitForFunction(()=>window.normalQuoteHeadCommitted===true);
 const head=(await f.getDoc(ref)).data();assert.equal(head.generation,headBefore.generation+1);
 await page.context().setOffline(true);await page.evaluate(()=>{window.normalReleaseQuoteAckLoss();return true;});
 await until(async()=>(await image(phone)).outbox.find(op=>op.key===added[0].key)?.phase==='uncertain');
 await page.context().tracing.stop({path:path.join(artifacts,'duplicate-before-restart.zip')});
 await restartProbe(phone,{crash:true});await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 await until(async()=>(await image(phone)).outbox.find(op=>op.key===added[0].key)?.phase==='verified');
 assert.deepEqual(JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1),history);
 assert.deepEqual((await f.getDoc(ref)).data(),head);assert.deepEqual((await f.getDoc(oldRevisionRef)).data(),oldRevision);
 await until(async()=>(await image(computer)).replicas.find(row=>row.key===scope)?.base?.revisionId===head.revisionId);
 assert.deepEqual(JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1),history);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 t.diagnostic('Explicit duplicate: same logical ID/name/status/totals/pins, old protected history/revision exact, one operation, SIGKILL and uncertain ACK recovered without duplicate');
}
