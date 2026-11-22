import assert from 'node:assert/strict';
import * as f from 'firebase/firestore';
import {nativeFixtureState} from './p0b-fixture-baseline.mjs';

export async function startupDraftCase(c){
 const {t,phone,computer,iid,pid,wardrobeId,pin,image,rows,until,saveProject,showList,openRoom,addCabinet,login,restartProbe,db,ownerUid,globalBefore,artifacts}=c;
 const editorRef=f.doc(db,'users',ownerUid,'p0bRoomEditors',pid),headRef=f.doc(db,'users',ownerUid,'p0bRoomProjects',pid);
 await phone.page.context().setOffline(true);await phone.page.waitForFunction(()=>navigator.onLine===false);
 const original=await image(phone),native=await nativeFixtureState(phone),draft=rows(original).fc_edit_session_v1;
 assert.equal(JSON.parse(draft).active,true);assert.equal(JSON.parse(rows(original).fc_projects_v1).find(row=>row.id===pid).projectData[pid].cabinets[0].width,77);
 assert.equal(native.raw.fc_sheet_materials_v1,null,'Desktop native originals stay empty; verified IDB catalogs are present');assert.ok(rows(original).fc_sheet_materials_v1);
 const before=(await f.getDoc(editorRef)).data();
 await saveProject(computer.page);await showList(computer.page);
 await computer.page.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();
 await computer.page.waitForFunction(()=>window.uiState.entry==='rooms'&&!window.FC.applicationStartup.inspect().transactionPending);
 await openRoom(computer,pid);const panel=computer.page.locator('.panel-box').filter({hasText:'Odzyskaj projekt'});await panel.waitFor();
 // The peer has no trace. The owner's PIN must never enter trace/log files.
 await panel.getByLabel('PIN przejęcia').fill(pin);
 const reload=computer.page.waitForEvent('domcontentloaded');
 await panel.getByRole('button',{name:'Pobierz najnowszą wersję',exact:true}).click();await computer.page.locator('.confirm-box').getByRole('button',{name:'Odzyskaj projekt',exact:true}).click();await reload;await login(computer);
 const taken=(await f.getDoc(editorRef)).data();assert.equal(taken.deviceLabel,'Telefon DEMO');assert.equal(taken.epoch,before.epoch+1);
 await openRoom(computer,pid);await computer.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 await addCabinet(computer,88);await saveProject(computer.page);const published=(await f.getDoc(headRef)).data(),confirmedEditor=(await f.getDoc(editorRef)).data();
 await phone.page.context().tracing.stop({path:artifacts+'/startup-draft-before-restart.zip'});
 await restartProbe(phone,{crash:true});await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
 const page=phone.page;await page.locator('.panel-box').filter({hasText:'Odzyskaj projekt'}).waitFor();
 const restored=await image(phone),afterNative=await nativeFixtureState(phone);
 assert.equal(await page.evaluate(()=>window.FC.applicationStartup.inspect().stage),'ready');assert.equal(await page.evaluate(()=>window.FC.session.active&&window.FC.session.durable),true);
 assert.equal(rows(restored).fc_projects_v1,rows(original).fc_projects_v1);assert.equal(rows(restored).fc_edit_session_v1,draft);
 assert.deepEqual(restored.outbox,original.outbox);assert.deepEqual(restored.replicas,original.replicas);for(const old of original.protected)assert.deepEqual(restored.protected.find(row=>row.key===old.key),old);
 assert.deepEqual(afterNative.raw,native.raw);assert.deepEqual(afterNative.binding,native.binding);assert.deepEqual((await f.getDoc(editorRef)).data(),confirmedEditor);assert.deepEqual((await f.getDoc(headRef)).data(),published);
 assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
 await page.screenshot({path:artifacts+'/startup-draft-recovered.png'});await page.context().tracing.stop({path:artifacts+'/startup-draft-recovered.zip'});
 t.diagnostic('Cold restart after real PIN takeover and newer server room admits verified durable draft to existing recovery; RAW/IDB/outbox/other room preserved; no automatic ownership or publication');
}