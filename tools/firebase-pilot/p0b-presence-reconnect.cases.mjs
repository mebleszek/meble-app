import assert from 'node:assert/strict';
import * as f from 'firebase/firestore';
export async function presenceReconnectCase({t,phone,computer,iid,pid,wardrobeId,image,rows,until,db,ownerUid,saveProject,showList,projects,openRoom,restartProbe,globalBefore}){
 const desktop=computer.page,errors=[];desktop.on('pageerror',error=>errors.push(error.message));
 const editorRef=id=>f.doc(db,'users',ownerUid,'p0bRoomEditors',id);
 await Promise.all([saveProject(phone.page),saveProject(desktop)]);
 await Promise.all([showList(phone.page),showList(desktop)]);
 await until(async()=>!(await f.getDoc(editorRef(pid))).data().active&&!(await f.getDoc(editorRef(wardrobeId))).data().active);
 // Real trusted consent on one installation; the other keeps its ordinary
 // in-memory desktop admission, the exact distinction in the owner's report.
 await phone.page.locator('#main-trust-phone').check();await phone.page.waitForFunction(()=>document.getElementById('main-trust-phone').checked&&!document.getElementById('main-trust-phone').disabled);
 for(const device of [phone,computer]){
  await device.page.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();
  await device.page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
  await projects(device.page);
 }
 assert.equal(await desktop.locator('#main-trust-phone').isChecked(),false);
 const released=()=>desktop.locator('[data-room-occupancy="'+wardrobeId+'"]').textContent();
 await until(async()=>await released()==='Zwolnione');
 const before=await image(computer),peer=await image(phone),popups=await desktop.evaluate(()=>window.popupCalls);
 await desktop.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
 await until(async()=>await released()==='Stan zajętości niepotwierdzony');
 const cdp=await desktop.context().newCDPSession(desktop);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await cdp.send('Page.setWebLifecycleState',{state:'active'});
 await desktop.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false}));document.dispatchEvent(new Event('visibilitychange'));});
 await until(async()=>await released()==='Zwolnione');
 assert.equal(await desktop.evaluate(()=>window.FC.applicationStartup.inspect().stage),'ready');
 assert.equal(await desktop.evaluate(()=>window.popupCalls),popups,'Renewal must reuse the existing Google identity without another popup');
 assert.deepEqual(rows(await image(computer)),rows(before));assert.deepEqual((await image(computer)).outbox,before.outbox);
 assert.deepEqual(rows(await image(phone)),rows(peer),'The other installation is not altered by a local proof renewal');
 await Promise.all([openRoom(phone,pid),openRoom(computer,wardrobeId)]);
 await Promise.all([phone,computer].map(d=>d.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending)));
 assert.equal((await f.getDoc(editorRef(pid))).data().deviceId,(await image(phone)).control.find(r=>r.key==='binding').deviceId);
 assert.notEqual((await f.getDoc(editorRef(pid))).data().deviceId,(await f.getDoc(editorRef(wardrobeId))).data().deviceId);
 await Promise.all([showList(phone.page),showList(desktop)]);
 await until(async()=>!(await f.getDoc(editorRef(pid))).data().active&&!(await f.getDoc(editorRef(wardrobeId))).data().active);
 await desktop.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();await projects(desktop);
 const offlineBefore=await image(computer);
 await desktop.context().setOffline(true);await until(async()=>await released()==='Stan zajętości niepotwierdzony');
 await openRoom(computer,wardrobeId);await desktop.locator('.info-box').waitFor();
 assert.match(await desktop.locator('.info-box').innerText(),/LF_OFFLINE_EDITOR_REQUIRED/);
 assert.deepEqual(rows(await image(computer)),rows(offlineBefore));assert.deepEqual((await image(computer)).outbox,offlineBefore.outbox);
 await desktop.locator('.info-box .is-success').click();await desktop.context().setOffline(false);
 await until(async()=>await released()==='Zwolnione');await openRoom(computer,wardrobeId);
 await desktop.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 await showList(desktop);await until(async()=>!(await f.getDoc(editorRef(wardrobeId))).data().active);
 await restartProbe(computer,{crash:true});assert.equal((await f.getDoc(editorRef(wardrobeId))).data().active,false);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 assert.deepEqual(errors,[]);
 t.diagnostic('Real main Auth/appAccess lease: trusted peer and desktop background/reconnect, released UI, real room entry, offline refusal, ACK, independent locks, IDB/outbox and restart preserved');
}
