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
}
