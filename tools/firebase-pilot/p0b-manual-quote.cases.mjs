import assert from 'node:assert/strict';
import * as f from 'firebase/firestore';

export async function manualQuoteCase(c){
 const {t,phone,computer,iid,pid,wardrobeId,pin,until,image,rows,addCabinet,saveProject,artifacts,db,ownerUid,globalBefore,restartProbe,mode}=c;
 let page=phone.page;const history=state=>JSON.parse(rows(state).fc_quote_snapshots_v1||'[]');
 const editorRef=id=>f.doc(db,'users',ownerUid,'p0bRoomEditors',id),headRef=id=>f.doc(db,'users',ownerUid,'p0bRoomProjects',id);
 const kitchen=(await f.getDoc(editorRef(pid))).data(),wardrobe=(await f.getDoc(editorRef(wardrobeId))).data();
 for(const width of [320,393,1024]){
  await page.setViewportSize({width,height:852});
  const measured=await page.evaluate(()=>{const bar=document.getElementById('main-auth-bar'),button=document.getElementById('main-sync');const actual=bar.getBoundingClientRect().height;button.style.display='none';const without=bar.getBoundingClientRect().height;button.style.display='';return {actual,without,width:bar.clientWidth,content:bar.scrollWidth,text:button.textContent};});
  assert.equal(measured.text,'Synchronizuj');assert.equal(measured.actual,measured.without,'The new label must not increase header height at '+width);assert.ok(measured.content<=measured.width+1,'The header must stay within the viewport at '+width);
 }
 await page.setViewportSize({width:393,height:852});await page.screenshot({path:artifacts+'/manual-sync-header.png'});
 const beforeHead=(await f.getDoc(headRef(wardrobeId))).data();
 await addCabinet(computer,53);await saveProject(computer.page,{flush:false});
 const queued=await image(computer);assert.ok(queued.outbox.some(row=>row.scope===wardrobeId&&row.phase==='queued'&&row.batch));
 assert.deepEqual((await f.getDoc(headRef(wardrobeId))).data(),beforeHead,'Main Save still uses the existing 2/5 minute batch');
 await computer.page.locator('#main-sync').click();
 await computer.page.waitForFunction(()=>document.getElementById('main-sync').dataset.syncState==='success'||document.querySelector('.info-box'));
 assert.equal(await computer.page.locator('#main-sync').getAttribute('data-sync-state'),'success',await computer.page.locator('.info-box').allTextContents());
 await until(async()=>(await image(computer)).outbox.every(row=>row.phase==='verified'));
 const latestWardrobe=(await f.getDoc(headRef(wardrobeId))).data();assert.notEqual(latestWardrobe.currentRevisionId,beforeHead.currentRevisionId);
 await until(async()=>JSON.parse(rows(await image(phone)).fc_projects_v1).find(row=>row.id===wardrobeId).projectData[wardrobeId].cabinets.length===2);
 assert.deepEqual((await f.getDoc(editorRef(wardrobeId))).data(),wardrobe,'Manual sync does not release the editor');
 // A third cabinet stays only in the other device's durable edit draft.
 await addCabinet(computer,41);const unsent=await image(computer);
 const start=await image(phone);await page.getByRole('button',{name:'Wyceń',exact:true}).click();
 const warning=page.locator('.quote-lock-warning');await warning.waitFor();
 assert.match(await warning.innerText(),/P0B wardrobe.*Komputer DEMO/s);
 await warning.getByRole('button',{name:'Nie',exact:true}).click();await warning.waitFor({state:'hidden'});
 const cancelled=await image(phone);assert.deepEqual(history(cancelled),history(start));assert.deepEqual(cancelled.outbox,start.outbox);assert.equal(rows(cancelled).fc_projects_v1,rows(start).fc_projects_v1);
 await page.getByRole('button',{name:'Wyceń',exact:true}).click();await warning.waitFor();await warning.getByRole('button',{name:'Tak',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-quote-history-id]')||document.querySelector('.info-box'));
 assert.equal(await page.locator('.info-box').count(),0,await page.locator('.info-box').allTextContents());
 const quoted=await image(phone),offers=history(quoted);assert.equal(offers.length,1);const offer=offers[0];
 assert.deepEqual(offer.scope.selectedRooms.slice().sort(),[pid,wardrobeId].sort());assert.equal(offer.scope.sourceProjects.find(row=>row.projectId===wardrobeId).revision.currentRevisionId,latestWardrobe.currentRevisionId);
 assert.equal(rows(quoted).fc_projects_v1,rows(start).fc_projects_v1,'Read-only pricing does not change room statuses or data');
 await until(async()=>(await image(phone)).outbox.every(row=>row.phase==='verified'));
 assert.deepEqual((await f.getDoc(editorRef(pid))).data(),kitchen);assert.deepEqual((await f.getDoc(editorRef(wardrobeId))).data(),wardrobe);
 await page.waitForFunction(()=>{const r=window.FC.wycenaTabShell._generateRuntime;return !r.inFlight&&Date.now()-r.lastReleasedAt>=1200&&Date.now()-r.lastAcceptedAt>=1500;});
 await page.getByRole('button',{name:'Wyceń',exact:true}).click();await warning.waitFor();await warning.getByRole('button',{name:'Uwolnij blokowane',exact:true}).click();
 // Secret values must not enter trace action arguments, logs or screenshots.
 await page.context().tracing.stop({path:artifacts+'/manual-quote-before-pin.zip'});
 const secret=warning.getByLabel('PIN',{exact:true}),wrong=String((Number(pin)+1)%10000).padStart(4,'0');await secret.fill(wrong);await warning.getByRole('button',{name:'Uwolnij blokowane',exact:true}).click();
 await warning.getByRole('status').filter({hasText:'LF_P0B_PIN_INCORRECT'}).waitFor();assert.equal(await secret.inputValue(),'');assert.deepEqual((await f.getDoc(editorRef(wardrobeId))).data(),wardrobe);
  if(mode==='crash')await page.evaluate(()=>window.normalHoldQuoteRelease=true);
 await secret.fill(pin);await warning.getByRole('button',{name:'Uwolnij blokowane',exact:true}).click();
 if(mode==='crash'){
  await page.waitForFunction(()=>!!window.normalQuoteReleaseCommitted);
  assert.ok((await image(phone)).control.some(row=>row.key.startsWith('quote-release:')));
  assert.equal((await f.getDoc(editorRef(wardrobeId))).data().active,false);
  await restartProbe(phone,{crash:true});page=phone.page;
  await until(async()=>!(await image(phone)).control.some(row=>row.key.startsWith('quote-release:')));
 }else{await warning.getByRole('status').filter({hasText:'Zwolnienie potwierdzone'}).waitFor();assert.equal(await secret.inputValue(),'');}
 await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 const released=(await f.getDoc(editorRef(wardrobeId))).data();assert.equal(released.active,false);assert.equal(released.epoch,wardrobe.epoch+1);assert.equal(released.headRevision,latestWardrobe.currentRevisionId);
 assert.deepEqual((await f.getDoc(headRef(wardrobeId))).data(),latestWardrobe,'PIN release does not publish the unsent cabinet');assert.deepEqual((await f.getDoc(editorRef(pid))).data(),kitchen);
 assert.deepEqual(history(await image(phone)),offers,'Unlock does not automatically calculate another quote');
 if(mode!=='crash')await warning.getByRole('button',{name:'Nie',exact:true}).click();
 const preserved=await image(computer);assert.equal(rows(preserved).fc_projects_v1,rows(unsent).fc_projects_v1);assert.equal(rows(preserved).fc_edit_session_v1,rows(unsent).fc_edit_session_v1);assert.deepEqual(preserved.outbox,unsent.outbox);
 // Local Save can still preserve work before this profile observes the new
 // epoch. Its old generation must never publish or receive a false cloud ACK.
 await computer.page.locator('#sessionSave').click();await computer.page.locator('.info-box').waitFor();
 const notice=computer.page.locator('.info-box'),localConfirmed=/Projekt zapisany/.test(await notice.innerText());if(localConfirmed)await notice.locator('.is-success').click();
 await computer.page.locator('.panel-box').filter({hasText:'Odzyskaj projekt'}).waitFor();
 const refused=await image(computer),beforeRecords=JSON.parse(rows(unsent).fc_projects_v1),afterRecords=JSON.parse(rows(refused).fc_projects_v1);
 for(const before of beforeRecords){const after=afterRecords.find(row=>row.id===before.id);assert.ok(after);if(before.id===wardrobeId){assert.ok(after.updatedAt>=before.updatedAt);assert.deepEqual({...after,updatedAt:before.updatedAt},before);}else assert.deepEqual(after,before);}
 for(const previous of unsent.outbox)assert.deepEqual(refused.outbox.find(op=>op.key===previous.key),previous);
 const stale=refused.outbox.filter(op=>!unsent.outbox.some(previous=>previous.key===op.key));if(localConfirmed)assert.ok(stale.length);else{assert.equal(stale.length,0);assert.equal(rows(refused).fc_edit_session_v1,rows(unsent).fc_edit_session_v1);}
 assert.ok(stale.every(op=>op.phase!=='verified'&&op.editor.epoch===wardrobe.epoch),'Old generation stays local and cannot obtain ACK');
 assert.deepEqual((await f.getDoc(headRef(wardrobeId))).data(),latestWardrobe);
 const saved=await image(phone);assert.equal(saved.control.some(row=>row.key.startsWith('quote-release:')),false);assert.ok(saved.control.some(row=>row.key.startsWith('quote-release-done:')));
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 t.diagnostic('Header retains its height/one line at 320/393/1024; real Sync flushes the queued batch; No/Yes/PIN, immutable confirmed sources, no automatic calculation, old draft/outbox and fenced generation preserved');
}
