import assert from 'node:assert/strict';
import * as f from 'firebase/firestore';

export async function roomReservationCase({t,phone,computer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,globalBefore,saveProject,addCabinet}){
 const editor=phone.page,quote=computer.page;
 const read=(collection,id,...tail)=>f.getDocFromServer(f.doc(db,'users',ownerUid,collection,id,...tail)).then(snap=>snap.data());
 const request=()=>read('p0bRoomEditors',pid,'quoteRequest','current');
 const marker=room=>read('p0bRoomEditors',room,'quoteReservation','current');
 const head=room=>read('p0bRoomProjects',room);
 // The chooser deliberately excludes rooms that still have no saved cabinets.
 await saveProject(editor);
 const cabinets=async device=>JSON.parse(rows(await image(device)).fc_projects_v1).find(row=>row.id===pid).projectData[pid].cabinets;
 const before=await head(pid);
 await addCabinet(phone,68);
 assert.deepEqual((await cabinets(phone)).map(row=>row.width),[66,68]);
 assert.deepEqual(await head(pid),before,'Second cabinet is still an unconfirmed draft');
 const beforeHistory=rows(await image(computer)).fc_quote_snapshots_v1;
 // Start with one saved selection so the new checkbox can be distinguished
 // from a restoration of the previous room list.
 assert.notEqual(await quote.evaluate(async id=>{
  const api=window.FC.quoteOfferStore,draft=api.getCurrentDraft();
  return api.commitSettings(draft,()=>!!api.patchCurrentDraft({selection:{selectedRooms:[id]}}));
 },wardrobeId),false);
 await quote.locator('[data-action="tab"][data-tab="wycena"]').click();
 const transition=quote.getByRole('button',{name:'Zapisz i przejdź',exact:true});
 await transition.click();
 await quote.waitForFunction(()=>window.uiState.activeTab==='wycena'&&!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.equal((await quote.evaluate(()=>window.FC.applicationStartup.synchronize())).ok,true);
 assert.deepEqual((await cabinets(computer)).map(row=>row.width),[66],'The chooser uses a real received project and the second cabinet is still pending');
 await until(async()=> (await marker(wardrobeId))?.active===true);
 assert.equal(await request(),undefined);
 await quote.locator('.quote-selection-launch--rooms').click();
 const picker=quote.locator('.rozrys-picker-modal');
 const kitchen=picker.locator('label').filter({hasText:'P0B kitchen'});
 await kitchen.click();
 assert.equal(await kitchen.locator('input').isChecked(),true);
 const prompt=editor.getByRole('dialog').filter({hasText:'Prośba o pomieszczenie do wyceny'});
 await until(async()=> (await request())?.state==='pending');
 assert.equal(await picker.isVisible(),true,'Checkbox sends a request before confirming the form');
 await prompt.getByRole('button',{name:'Nie',exact:true}).click();
 await until(async()=> (await request())?.state==='declined');
 assert.deepEqual(await head(pid),before);
 assert.equal(rows(await image(computer)).fc_quote_snapshots_v1,beforeHistory);
 await picker.getByRole('button',{name:'Zatwierdź',exact:true}).click();
 await picker.waitFor({state:'hidden'});
 await quote.locator('[data-action="wycena-generate"]').click();
 const warning=quote.locator('.quote-lock-warning');
 await warning.getByText(/Odmowa/).waitFor();
 await warning.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();
 await prompt.getByRole('button',{name:'OK',exact:true}).click();
 await until(async()=> (await request())?.state==='granted');
 const saved=await head(pid);
 assert.notEqual(saved.currentRevisionId,before.currentRevisionId);
 assert.equal((await marker(pid)).revision,saved.currentRevisionId);
 assert.deepEqual((await cabinets(phone)).map(row=>row.width),[66,68]);
 assert.equal(rows(await image(phone)).fc_edit_session_v1,null);
 assert.equal(await editor.evaluate(()=>window.uiState.activeTab),'inwestor');
 assert.ok((await image(phone)).outbox.filter(row=>row.scope===pid).every(row=>row.phase==='verified'));
 await warning.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();
 await until(async()=> (await image(computer)).outbox.some(row=>row.scope.startsWith('p0b_quotes_')&&row.phase==='verified'));
 const offers=JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1);
 assert.equal(offers.length,1);
 assert.deepEqual((await cabinets(computer)).map(row=>row.width),[66,68]);
 assert.deepEqual(offers[0].scope.selectedRooms.slice().sort(),[pid,wardrobeId].sort());
 assert.equal(offers[0].scope.sourceProjects.find(row=>row.projectId===pid).revision.currentRevisionId,saved.currentRevisionId);
 await quote.locator('[data-action="tab"][data-tab="inwestor"]').click();
 await until(async()=> (await marker(pid))?.active===false&&(await marker(wardrobeId))?.active===false);
 assert.deepEqual(await head(pid),saved);
 assert.deepEqual(await read('globalData','current'),globalBefore);
 t.diagnostic('Real checkbox request, decline, retry, peer Save and ACK, two-room publication and release all proved in normal DEMO');

 const pin='1379';
 await editor.evaluate(value=>window.FC.projectTakeoverPin.save({newPin:value,confirmation:value,expectedRevision:0}),pin);
 await quote.locator('[data-action="tab"][data-tab="wycena"]').click();
 await until(async()=> (await marker(pid))?.active===true&&(await marker(wardrobeId))?.active===true);
 const orphaned=await marker(pid),untouched=await marker(wardrobeId),oldLedger=await read('p0bRoomQuotes',iid);
 await computer.owner.crash();
 assert.deepEqual(await marker(pid),orphaned,'The disconnected profile left a confirmed reservation');

 assert.notEqual(await editor.evaluate(async id=>{
  const api=window.FC.quoteOfferStore,draft=api.getCurrentDraft();
  return api.commitSettings(draft,()=>!!api.patchCurrentDraft({selection:{selectedRooms:[id]}}));
 },pid),false);
 await editor.locator('[data-action="tab"][data-tab="wycena"]').click();
 await editor.waitForFunction(()=>window.uiState.activeTab==='wycena'&&!window.FC.session.active);
 await editor.locator('[data-action="wycena-generate"]').click();
 const recovery=editor.locator('.quote-lock-warning'),take=recovery.getByRole('button',{name:'Przejmij PIN-em',exact:true});
 await recovery.getByText(/Zarezerwowane do wyceny/).waitFor();
 await take.click();
 await recovery.getByLabel('PIN',{exact:true}).fill('8642');
 await take.click();
 await recovery.getByRole('status').filter({hasText:'LF_P0B_PIN_INCORRECT'}).waitFor();
 assert.deepEqual(await marker(pid),orphaned);
 assert.deepEqual(await marker(wardrobeId),untouched);
 assert.deepEqual(await read('p0bRoomQuotes',iid),oldLedger);

 await recovery.getByLabel('PIN',{exact:true}).fill(pin);
 await take.click();
 await recovery.waitFor({state:'hidden'});
 await until(async()=>{const acquired=await marker(pid);return acquired?.active&&acquired.token!==orphaned.token;},[phone]);
 const acquired=await marker(pid);
 assert.ok(acquired.epoch>orphaned.epoch);
 assert.equal(acquired.revision,orphaned.revision);
 const naming=editor.locator('.quote-scope-entry-modal--name');
 await editor.waitForFunction(id=>document.querySelector('.quote-scope-entry-modal--name')
  ||Array.from(document.querySelectorAll('[data-quote-history-id]')).some(row=>row.dataset.quoteHistoryId!==id),offers[0].id);
 if(await naming.isVisible())await naming.getByRole('button',{name:'OK',exact:true}).click();
 await until(async()=>{const head=await read('p0bRoomQuotes',iid);return head?.generation===oldLedger.generation+1;},[phone]);
 const history=JSON.parse(rows(await image(phone)).fc_quote_snapshots_v1);
 assert.deepEqual(history.find(row=>row.id===offers[0].id),offers[0]);
 assert.deepEqual(history.find(row=>row.id!==offers[0].id).scope.selectedRooms,[pid]);
 await editor.locator('[data-action="tab"][data-tab="inwestor"]').click();
 await until(async()=> (await marker(pid))?.active===false,[phone]);
 assert.deepEqual(await marker(wardrobeId),untouched,'Another selected room needs its own confirmed recovery');
 assert.deepEqual(await head(pid),saved);
 assert.deepEqual(await read('globalData','current'),globalBefore);
 t.diagnostic('Real SIGKILL isolated the original profile. A wrong PIN changed nothing. Authorised release and a new reservation used the saved head, preserved both offers and left the other room untouched.');
}
