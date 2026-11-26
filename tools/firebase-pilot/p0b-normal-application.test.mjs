import {roomReservationCase} from './quote-room-reservation.cases.mjs';
import {startupDraftCase} from './p0b-startup-draft.cases.mjs';
import {observeQuoteReads,assertQuoteReadBudget} from './p0b-quote-read-budget.mjs';
import {quoteRouteRequestCase} from './quote-route-request.cases.mjs';
import {confirmQuoteSources,applicationIdle,waitForApplicationIdle} from './quote-ui-actions.mjs';
import {manualQuoteCase} from './p0b-manual-quote.cases.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomInt} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as f from 'firebase/firestore';
import {assertFails} from '@firebase/rules-unit-testing';
import {runNormalApplication} from './normal-application.cases.mjs';
import {promotionCase,stagingCase} from './p0b-quote-lifecycle.cases.mjs';
import {duplicateCase,tabSaveCase} from './quote-tab-regressions.cases.mjs';
import {accessResumeCase} from './p0b-access-resume.cases.mjs';
import {presenceReconnectCase} from './p0b-presence-reconnect.cases.mjs';
import {quoteRemovalCase} from './p0b-quote-removal.cases.mjs';
import {variantsCase} from './p0b-quote-variants.cases.mjs';
import {phoneQuoteFlow,rapidQuoteRemoval} from './p0b-phone-quote-flow.cases.mjs';
import {batchingCase} from './p1-project-sync.cases.mjs';
import {checkpointNativeFixture,nativeFixtureState} from './p0b-fixture-baseline.mjs';
async function image(device){
 return device.page.evaluate(name=>new Promise((resolve,reject)=>{
  const q=indexedDB.open('meble-lf-test-normal-'+name);q.onupgradeneeded=()=>q.transaction.abort();q.onerror=()=>reject(q.error);
  q.onsuccess=()=>{const db=q.result,tx=db.transaction(['control','replicas','outbox','protected'],'readonly'),out={};
   for(const key of ['control','replicas','outbox','protected']){const r=tx.objectStore(key).getAll();r.onsuccess=()=>out[key]=r.result;}
   tx.oncomplete=()=>{db.close();resolve(out);};tx.onabort=()=>{db.close();reject(tx.error);};};
 }),device.name);
}
const rows=value=>value.control.find(row=>row.key==='application').rows;
async function saveProject(page,{flush=true}={}){
 await page.locator('#sessionSave').click();const notice=page.locator('.info-box');await notice.waitFor();
 assert.match(await notice.innerText(),/Projekt zapisany/);await notice.locator('.is-success').click();
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 // Existing P0-B regressions explicitly synchronize; P1 cases observe batching.
 if(flush)assert.equal((await page.evaluate(()=>window.FC.applicationStartup.synchronize())).ok,true);
}
async function showList(page){
 await waitForApplicationIdle(page);
 if(await page.locator('#investorsListView').isVisible()){await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);return;}
 if(await page.locator('#sessionCancel').isVisible()){assert.equal(await page.locator('#sessionCancel').innerText(),'Wyjdź');await page.locator('#sessionCancel').click();await page.waitForFunction(()=>window.uiState.entry==='investorsList'&&!window.FC.applicationStartup.inspect().transactionPending);await waitForApplicationIdle(page);return;}
 if(await page.locator('#homeView').isVisible()){await page.locator('#openFurnitureProjectsBtn').click();await page.waitForFunction(()=>['modeHub','investorsList'].includes(window.uiState?.entry)&&!window.FC.applicationStartup.inspect().transactionPending);}
 if(await page.locator('#modeHubView').isVisible())await page.locator('[data-action="open-investors-list"]').filter({visible:true}).first().click();
 await page.locator('#investorsListView').waitFor({state:'visible'});
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
}
async function projects(page){
 await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending);
 if(!await page.locator('.room-project-picker').isVisible())await page.locator('[data-investor-action="projects"]').click();
 await page.locator('.room-project-picker').waitFor();
}
async function addRoom(device,name){
 const page=device.page;await projects(page);await page.locator('[data-investor-action="add-room"]').click();
 const panel=page.locator('.room-registry-modal');await panel.locator('input').fill(name);
 await panel.getByRole('button',{name:'Dodaj',exact:true}).click();await panel.waitFor({state:'hidden'});
 const record=JSON.parse(rows(await image(device)).fc_projects_v1).find(row=>row.title===name);
 assert.ok(record,'Named room must be committed before its modal closes');assert.equal(record.meta.roomProject.roomId,record.id);
 assert.deepEqual(record.projectData.meta.roomOrder,[record.id]);return record;
}
async function openRoom(device,id){await projects(device.page);await device.page.locator('.investor-room-quick-btn[data-room="'+id+'"]').click();}
async function addCabinet(device,width,drawer){
 const page=device.page;
 await page.waitForFunction(()=>window.FC.actions.isLocked('add-cabinet')===false);
 await page.locator('#floatingAdd').click();await page.locator('#cabinetModal').waitFor({state:'visible'});
 await page.locator('#cabinetTypeChoices .choice-tile').first().click();
 await page.locator('#cmWidth').fill(String(width));await page.locator('#cmHeight').fill('82');await page.locator('#cmDepth').fill('50');
 if(drawer){
  const select=async(id,value)=>page.evaluate(({id,value})=>{const el=document.getElementById(id);if(!el||!Array.from(el.options).some(o=>o.value===value))throw Error('DRAWER_UI_OPTION_REQUIRED:'+id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},{id,value});
  await select('cmSubType','szuflady');
  await select('cmExtraSelectDrawerSystem',drawer.system);
  if(drawer.system==='systemowe'){await select('cmExtraSelectDrawerBrand','blum');await select('cmExtraSelectDrawerModel','tandembox_antaro');}
  await select('cmExtraSelectDrawerBottomColor','white');
  if(drawer.push)await select('cmOpeningSystem','TIP-ON');
 }
 await page.locator('#cabinetModalSave').click();await page.locator('#cabinetModal').waitFor({state:'hidden'});
}
async function cleanApplication(t,{deployment=false,full=true,quoteProbe=false,quoteReadBudget=false,quoteAcceptance=false,quoteAcceptanceRace=false,quotePromotion=false,quoteStaging=false,quoteVariants=false,quoteDuplicate=false,quoteRemoval=false,quoteFilm=false,manualQuote=false,startupDraft=false,accessResume=false,presenceReconnect=false,p1=false}={}){
 await runNormalApplication(t,{deployment,p0bRegistry:true,factoryLabor:p1==='tab-save'||deployment&&quoteReadBudget,currentFactoryCatalogs:['offline-quote','reservation'].includes(p1),quoteReservationCandidate:p1==='reservation',realMainAuth:presenceReconnect,testOwner:startupDraft?'synthetic-startup-draft-owner':manualQuote?'synthetic-manual-quote-'+manualQuote+'-owner':quoteFilm?'synthetic-phone-flow-'+quoteFilm+'-owner':quoteRemoval?'synthetic-quote-removal-'+quoteRemoval+'-owner':presenceReconnect?'synthetic-presence-reconnect-owner':accessResume?'synthetic-background-owner':quoteDuplicate?'synthetic-duplicate-owner':p1?'synthetic-p1-'+p1+'-owner':deployment&&quoteProbe?'synthetic-signed-room-quote-owner':quoteVariants?'synthetic-quote-variants-owner':quotePromotion?'synthetic-quote-promotion-owner':quoteStaging?'synthetic-quote-staging-owner':quoteAcceptanceRace?'synthetic-room-acceptance-race-owner':quoteProbe?'synthetic-room-quote-owner':deployment?'synthetic-room-signed-owner':'synthetic-room-normal-owner',startupProbe:async({phone,computer,device,configure,login,restartProbe,source,env,ownerUid,until})=>{
  const artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'meble-p0b-normal-'));
  await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
  try{
   await configure(phone);await phone.page.reload();
   if(accessResume||presenceReconnect)await phone.page.evaluate(async()=>{await window.FC.offlineShell.prepare();await indexedDB.databases();});
   await login(phone);
   const initial=await image(phone);
   assert.deepEqual(JSON.parse(rows(initial).fc_investors_v1),[]);
   assert.deepEqual(JSON.parse(rows(initial).fc_projects_v1),[]);
   if(deployment){
    const refusal=await phone.page.evaluate(async({ownerUid,name})=>{
     const {verifyApplicationRelease}=await import('/sync/application-release.mjs'),{canonical}=await import('/sync/local-first-values.mjs');
     const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),publicKeySpki=new Uint8Array(await crypto.subtle.exportKey('spki',keys.publicKey));
     const decision={domain:'MEBLE_APPLICATION_DEPLOYMENT_V1',protocol:2,projectId:'demo-meble-app',database:'(default)',profile:'business-project-v1',globalDomains:14,ownerUid,activationId:'synthetic-deployment',origin:new URL('./',document.baseURI).href,migrationApproved:true,sourcePreserved:true,rulesApproved:true,rulesSha256:'a'.repeat(64)};
     const signature=new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(canonical(decision))));
     const trustedKeySha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',publicKeySpki)),b=>b.toString(16).padStart(2,'0')).join('');
     const release=await verifyApplicationRelease({envelope:{decision,publicKeySpki,signature},trustedKeySha256,origin:decision.origin});
     try{await (await import('/sync/application-migration-recovery.mjs')).recoverApplicationBinding({window,name:'meble-lf-test-normal-'+name,release,sourceHash:'a'.repeat(64)});return 'UNSAFE_DOWNGRADE';}catch(e){return e.code||e.message;}
    },{ownerUid,name:phone.name});
    assert.equal(refusal,'LF_P0B_REGISTRY_REQUIRED');assert.deepEqual(await image(phone),initial,'Rejected old deployment must not modify any IDB table');
   }
   const archive=JSON.parse(initial.protected.find(row=>row.key==='p0b-previous-registry').json);
   assert.equal(archive.sourceRows.fc_investors_v1,source.investors);
   assert.equal(archive.sourceRows.fc_projects_v1,source.projects);
   assert.equal(await phone.page.evaluate(()=>window.readNormalSource('fc_investors_v1')),source.investors);
   t.diagnostic('Clean normal startup preserved legacy RAW and archived the previous registry');
   if(!computer)computer=await device('computer',{prepareStatic:accessResume||presenceReconnect});else{await configure(computer);await computer.page.reload();if(accessResume||presenceReconnect)await computer.page.evaluate(async()=>{await window.FC.offlineShell.prepare();await indexedDB.databases();});await login(computer);}
   await phone.page.evaluate(()=>window.FC.localDeviceLabel.write('Telefon DEMO'));
   await computer.page.evaluate(()=>window.FC.localDeviceLabel.write('Komputer DEMO'));
   // Persist only the test's old source/name setup. All crash-tested business
   // writes, ACK losses and recovery checkpoints happen after this boundary.
   await phone.page.context().tracing.stop({path:path.join(artifacts,'fixture-baseline.zip')});
   const baseline=await checkpointNativeFixture(phone,restartProbe);
   assert.equal(baseline.nativeLabel,'Telefon DEMO');
   assert.equal(await phone.page.evaluate(()=>window.FC.localDeviceLabel.read()),'Telefon DEMO');
   await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
   t.diagnostic('Native fixture RAW, archive, deviceId and label survive an orderly baseline restart');
   const db=env.authenticatedContext(ownerUid,{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
   const globalBefore=(await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data();
   const page=phone.page;let pin;
   if(full&&(!quoteProbe||manualQuote)&&!p1){
    await page.context().tracing.stop();pin=String(randomInt(10000)).padStart(4,'0');
    try{
     await page.locator('#openDataSettingsBtn').click();await page.locator('[data-settings-section="security"]').click();
     await page.getByLabel('Nowy PIN',{exact:true}).fill(pin);await page.getByLabel('Powtórz nowy PIN').fill(pin);
     await page.getByRole('button',{name:'Zapisz PIN'}).click();await page.getByRole('status').filter({hasText:'Potwierdzono zapis PIN-u.'}).waitFor();
     await page.locator('.panel-box__close').click();
    }finally{for(const label of ['Nowy PIN','Powtórz nowy PIN'])if(await page.getByLabel(label,{exact:true}).count())await page.getByLabel(label,{exact:true}).fill('');await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});}
   }
   await showList(page);
   await page.locator('[data-action="create-investor"]').filter({visible:true}).first().click();
   // The form can be rendered before the navigation checkpoint commits.
   await waitForApplicationIdle(page);
   for(const [key,value]of Object.entries({invName:'P0B new owner',invPhone:'123456789',invCity:'DEMO',invEmail:'p0b@example.invalid',invAddress:'Synthetic',invTransportDistanceKm:'12',invTransportDurationMin:'30',invCarryingFloorNumber:'0'}))await page.locator('#'+key).fill(value);
   await page.locator('#invSourceLaunch button').click();
   await page.locator('.rozrys-choice-modal .rozrys-choice-option:not([disabled])').nth(1).click();
   await page.locator('#investorActionBar [data-investor-action="save"]').click();
   await page.locator('.confirm-box .is-success').click();
   await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
   const saved=await image(phone),investors=JSON.parse(rows(saved).fc_investors_v1);
   assert.equal(investors.length,1,await page.locator('body').innerText());
   const iid=investors[0].id;
   await until(async()=>{const state=await image(phone);return state.outbox.some(row=>row.scope.startsWith('p0b_contact_')&&row.phase==='verified');});
   const remote=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();
   assert.equal(JSON.parse(remote.contact).name,'P0B new owner');
   await until(async()=>JSON.parse(rows(await image(computer)).fc_investors_v1).some(row=>row.id===iid));
   assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
   assert.equal(rows(await image(phone)).fc_sheet_materials_v1,rows(initial).fc_sheet_materials_v1);
   t.diagnostic('New contact is durable in IndexedDB, ACK verified, second profile received it, globals unchanged');
   if(!full)return;
   assert.equal(JSON.parse(rows(await image(phone)).fc_projects_v1).length,0,'Contact creation must not create an apartment or select the first room');
   const project=await addRoom(phone,'P0B kitchen'),pid=project.id,roomId=pid;
   await until(async()=>{const state=await image(phone);return state.outbox.some(row=>row.scope===pid&&row.phase==='verified');});
   const lease=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid))).data();
   assert.equal(lease.active,true);
   await until(async()=>{const state=await image(phone);return state.outbox.filter(row=>row.scope===pid).every(row=>row.phase==='verified');});
   const body=await page.locator('body').innerText();assert.ok(!body.includes('LF_ASYNC_TRANSACTION_REQUIRED'),body);
   await until(async()=>{const state=await image(computer);return JSON.parse(rows(state).fc_projects_v1).find(row=>row.id===pid)?.projectData.meta.roomDefs[roomId];});
   t.diagnostic('Real Add room is durable, project ACK verified and second profile received the room');
   await showList(computer.page);
   await computer.page.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();
   await computer.page.waitForFunction(iid=>window.uiState?.currentInvestorId===iid&&window.uiState.entry==='rooms'&&!window.FC.applicationStartup.inspect().transactionPending,iid);
   assert.equal(rows(await image(computer)).fc_current_project_id_v1,'','Receiving a first room must not select it automatically');
   const wardrobe=await addRoom(computer,'P0B wardrobe'),wardrobeId=wardrobe.id;
   await until(async()=>{const state=await image(computer);return state.outbox.some(row=>row.scope===wardrobeId&&row.phase==='verified');});
   await Promise.all([openRoom(phone,roomId),openRoom(computer,wardrobeId)]);
   await Promise.all([phone,computer].map(d=>d.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending)));
   const beforeCabinet=await image(phone),beforeWardrobe=await image(computer);
   await Promise.all([addCabinet(phone,66),addCabinet(computer,77)]);
   const wardrobeDraft=await image(computer);assert.equal(wardrobeDraft.outbox.length,beforeWardrobe.outbox.length);
   assert.equal(JSON.parse(rows(wardrobeDraft).fc_projects_v1).find(row=>row.id===wardrobeId).projectData[wardrobeId].cabinets[0].width,77);
   const draft=await image(phone);
   assert.equal(draft.outbox.length,beforeCabinet.outbox.length);
   const sourceCabinet=JSON.parse(rows(draft).fc_projects_v1).find(row=>row.id===pid).projectData[roomId].cabinets[0];
   assert.equal(sourceCabinet.width,66);
   if(quoteReadBudget){
    // Exercise the real default replay guard even on slower machines. The UI
    // helper must observe expiry, never clear the lock or repeat the click.
    for(let i=0;i<2;i++){
     await page.evaluate(()=>{window.FC.actions.lock('add-cabinet');if(!window.FC.actions.isLocked('add-cabinet'))throw Error('ADD_GUARD_NOT_ARMED');});
     await addCabinet(phone,60,{system:i===0?'skrzynkowe':'systemowe',push:i===0});
    }
   }
   if(startupDraft){
    await phone.page.context().tracing.stop({path:artifacts+'/startup-peer-before-pin.zip'});await computer.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
    await startupDraftCase({t,phone:computer,computer:phone,iid,pid:wardrobeId,wardrobeId:pid,pin,image,rows,until,saveProject,showList,openRoom,addCabinet,login,restartProbe,db,ownerUid,globalBefore,artifacts});return;
   }
   if(presenceReconnect){await presenceReconnectCase({t,phone,computer,iid,pid,wardrobeId,image,rows,until,db,ownerUid,saveProject,showList,projects,openRoom,restartProbe,globalBefore});return;}
   if(accessResume){await accessResumeCase({t,phone,computer,iid,pid,wardrobeId,image,rows,until,db,ownerUid,saveProject,showList,restartProbe,globalBefore});return;}
   if(p1==='reservation'){await roomReservationCase({t,phone,computer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,globalBefore,saveProject,addCabinet});return;}
   if(p1==='tab-save'){await tabSaveCase({t,phone,computer,iid,pid,wardrobeId,until,image,rows,openRoom,addCabinet,restartProbe,artifacts});return;}
   if(p1){await batchingCase({t,phone,computer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,showList,openRoom,addCabinet,saveProject,restartProbe,globalBefore},{idle:p1==='idle',quoteOnly:p1==='quote',offlineQuote:p1==='offline-quote'});return;}
   await Promise.all([saveProject(page),saveProject(computer.page)]);
   await until(async()=>{const state=await image(phone);return state.outbox.filter(row=>row.scope===pid).every(row=>row.phase==='verified');});
   assert.equal((await image(phone)).outbox.filter(row=>row.scope===pid).length,beforeCabinet.outbox.filter(row=>row.scope===pid).length+1);
   await until(async()=>{const state=await image(computer);return state.outbox.filter(row=>row.scope===wardrobeId).every(row=>row.phase==='verified');});
   const wardrobeHead=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',wardrobeId))).data();
   assert.equal(JSON.parse((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data().contact).name,'P0B new owner');
   const confirmedHead=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data();
   t.diagnostic('Parallel real UI cabinet drafts and Save use independent room CAS/outboxes; contact and globals remain unchanged');
   if(quoteProbe){
    const quoteRooms=quoteRemoval==='single'?[pid]:[pid,wardrobeId];
    await until(async()=>JSON.parse(rows(await image(phone)).fc_projects_v1).some(row=>row.id===wardrobeId));
    const confirmRoute=quoteReadBudget?await quoteRouteRequestCase({t,phone,computer,iid,pid,image,rows,until,db,ownerUid,artifacts,firestore:f}):null;
    const beforeQuote=await image(phone);
    await page.locator('[data-action="tab"][data-tab="wycena"]').click();
    await page.locator('[data-action="wycena-generate"]').waitFor();
    // Rendering the tab is not the completion of its durable navigation or
    // queued settings. Open the form only after the actual authority is idle.
    assert.equal(await page.evaluate(()=>window.FC.quoteOfferStore.settingsSettled()),true);
    await page.waitForFunction(()=>{const s=window.FC.applicationStartup.inspect();return !s.transactionPending&&!s.incomingPending;});
    await page.evaluate(()=>{
     const api=window.FC.quoteOfferStore,original=api.commitSettings;
     api.commitSettings=async function(...args){
      const before=window.FC.applicationStartup.inspect();
      try{const value=await original.apply(this,args);if(value===false)window.normalSettingsRefusal={code:'RETURNED_FALSE',before,after:window.FC.applicationStartup.inspect()};return value;}
      catch(error){window.normalSettingsRefusal={code:error.code||error.message,before,after:window.FC.applicationStartup.inspect()};throw error;}
     };
    });
    await page.locator('.quote-selection-launch--rooms').click();
    const picker=page.locator('.panel-box-backdrop'),labels=await picker.locator('label').allTextContents();
    assert.ok(labels.some(text=>text.includes('P0B kitchen'))&&labels.some(text=>text.includes('P0B wardrobe')),
     'Combined quote must offer both independent rooms; actual choices: '+JSON.stringify(labels));
    const wardrobeChoice=()=>picker.locator('label').filter({has:page.getByText('P0B wardrobe',{exact:true})});
    const kitchenChoice=()=>picker.locator('label').filter({has:page.getByText('P0B kitchen',{exact:true})});
    let selectionCommitted=false;
    if(await wardrobeChoice().locator('input').isChecked()&&await kitchenChoice().locator('input').isChecked()){
     // With no stored choice the existing picker previews all rooms. Make an
     // explicit durable single-room choice before extending it to both rooms.
     await wardrobeChoice().locator('.rozrys-room-chip__label').click();
     await page.waitForFunction(()=>{const s=window.FC.applicationStartup.inspect();return !s.transactionPending&&!s.incomingPending;});
     await page.getByRole('button',{name:'Zatwierdź',exact:true}).click();
     await page.waitForFunction(()=>{const panel=document.querySelector('.panel-box-backdrop'),notice=document.querySelector('.info-box');return !panel||!panel.getClientRects().length||!!notice?.getClientRects().length;});
     assert.equal(await page.locator('.info-box').count(),0,'Single-room choice failed: '+JSON.stringify(await page.evaluate(()=>window.normalSettingsRefusal)));
     await picker.waitFor({state:'hidden'});
     await page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());
     assert.deepEqual(JSON.parse(rows(await image(phone)).fc_quote_offer_drafts_v1).find(row=>row.projectId===pid).selection.selectedRooms,[pid]);
     if(quoteRooms.length===1)selectionCommitted=true;else await page.locator('.quote-selection-launch--rooms').click();
    }
    if(!selectionCommitted){for(const title of ['P0B kitchen','P0B wardrobe']){
     const choice=picker.locator('label').filter({has:page.getByText(title,{exact:true})});
     const wanted=title==='P0B kitchen'||quoteRooms.includes(wardrobeId);
     if(await choice.locator('input').isChecked()!==wanted)await choice.locator('.rozrys-room-chip__label').click();
    }
    await page.getByRole('button',{name:'Zatwierdź',exact:true}).click();await picker.waitFor({state:'hidden'});}
    await page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());
    assert.deepEqual(JSON.parse(rows(await image(phone)).fc_quote_offer_drafts_v1).find(row=>row.projectId===pid).selection.selectedRooms.slice().sort(),quoteRooms.slice().sort());
    const pcv=await page.evaluate(ids=>{
     const fc=window.FC,options=fc.projectPcvGuard.calculationOptions(),combined=fc.projectPcvResolver.requireCollection(ids,options);
     const individual=ids.map(id=>fc.projectPcvResolver.requireCollection([id],options));
     const contributions=combined.details.flatMap(d=>d.parts.flatMap(p=>p.effectivePcv?.contributions||[]));
     return {total:combined.edgeMeters,body:combined.edgeMetersByMode.body,front:combined.edgeMetersByMode.front,
      individual:individual.map(row=>({total:row.edgeMeters,body:row.edgeMetersByMode.body,front:row.edgeMetersByMode.front})),
      sources:contributions.map(c=>c.address),metersValid:contributions.every(c=>Math.abs(c.meters-fc.materialEdgeStore.edgingMetersForPart({a:c.aCm,b:c.bCm,qty:c.qty},c.edges))<1e-9)};
    },quoteRooms);
    for(const key of ['total','body','front'])assert.ok(Math.abs(pcv[key]-pcv.individual.reduce((sum,row)=>sum+row[key],0))<1e-8);
    assert.ok(pcv.metersValid&&pcv.total>0);assert.deepEqual([...new Set(pcv.sources.map(row=>row.projectId))].sort(),quoteRooms.slice().sort());
    assert.ok(pcv.sources.every(row=>row.projectId===row.roomId));
    if(quotePromotion||quoteStaging){await page.locator('.quote-preliminary-chip').click();await page.waitForFunction(()=>window.FC.quoteOfferStore.settingsSettled());}
    if(quoteStaging)await page.evaluate(()=>window.normalPauseQuoteChunk=true);
    if(!quoteAcceptance&&!quotePromotion&&!quoteStaging&&!quoteVariants&&!quoteDuplicate&&!quoteRemoval&&!quoteFilm&&!manualQuote)await page.evaluate(()=>window.normalLoseQuoteAck=true);
    if(manualQuote){await manualQuoteCase({t,phone,computer,iid,pid,wardrobeId,pin,until,image,rows,addCabinet,saveProject,artifacts,db,ownerUid,globalBefore,restartProbe,mode:manualQuote});return;}
    if(quoteReadBudget)await observeQuoteReads(page);
    await page.locator('[data-action="wycena-generate"]').click();if(confirmRoute)await confirmRoute();await confirmQuoteSources(page);
    await page.waitForFunction(()=>document.querySelector('[data-quote-history-id]')||document.querySelector('.info-box'));
    const calculationNotice=await page.locator('.info-box').allTextContents();
    assert.ok(await page.locator('[data-quote-history-id]').count(),'Combined Calculate refused: '+JSON.stringify(calculationNotice));
    const written=await image(phone),old=JSON.parse(rows(beforeQuote).fc_quote_snapshots_v1||'[]');
    const offer=JSON.parse(rows(written).fc_quote_snapshots_v1||'[]').find(row=>!old.some(prior=>prior.id===row.id));
    assert.ok(offer,'Real Calculate must commit history before showing success');
    if(quoteReadBudget){
     assert.equal(JSON.parse(rows(written).fc_projects_v1).find(row=>row.id===pid).projectData[pid].cabinets.length,3);
     assert.ok(offer.lines.accessories.some(row=>/TANDEM TIP-ON/.test(row.name)&&row.qty===3),'Signed combined quote includes three dedicated wooden-drawer push pairs');
     assert.match(JSON.stringify(offer.lines.materials),/Dno szuflad 10 mm białe/);
     assert.match(JSON.stringify(offer.lines.materials),/Płyta szuflad systemowych 16 mm biała/);
     await assertQuoteReadBudget(page,t);
    }
    assert.deepEqual(offer.scope.selectedRooms.slice().sort(),quoteRooms.slice().sort());
    assert.deepEqual(JSON.parse(rows(written).fc_projects_v1),JSON.parse(rows(beforeQuote).fc_projects_v1),'Calculating must not edit either room');
    const newQuoteOps=written.outbox.filter(op=>!beforeQuote.outbox.some(old=>old.key===op.key));
    const contactOps=newQuoteOps.filter(op=>op.scope.startsWith('p0b_contact_'));assert.equal(contactOps.length,confirmRoute?1:0,'Only the route prompt may add one contact operation');
    const queued=newQuoteOps.filter(op=>!contactOps.includes(op));assert.equal(queued.length,1);
    assert.ok(![pid,wardrobeId].includes(queued[0].scope),'Combined quote requires an independent ledger, not a room publication');
    assert.deepEqual(offer.scope.sourceProjects.map(ref=>ref.projectId).sort(),quoteRooms.slice().sort());
    assert.equal(offer.scope.sourceProjects.find(ref=>ref.projectId===pid).revision.currentRevisionId,confirmedHead.currentRevisionId);
    if(quoteRooms.includes(wardrobeId))assert.equal(offer.scope.sourceProjects.find(ref=>ref.projectId===wardrobeId).revision.currentRevisionId,wardrobeHead.currentRevisionId);
    const ledger=JSON.parse(written.replicas.find(row=>row.key===queued[0].scope).json);
    assert.equal(ledger.pins[offer.id].find(pin=>pin.projectId===pid).head.currentRevisionId,confirmedHead.currentRevisionId);
    if(quoteRooms.includes(wardrobeId))assert.equal(ledger.pins[offer.id].find(pin=>pin.projectId===wardrobeId).head.currentRevisionId,wardrobeHead.currentRevisionId);
    if(quoteFilm){await (quoteFilm==='rapid'?rapidQuoteRemoval:phoneQuoteFlow)({t,phone,computer,offer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,showList,projects,openRoom,saveProject,artifacts,restartProbe,device,configure,login});return;}
    if(quoteRemoval){await quoteRemovalCase({t,phone,computer,offer,iid,pid,wardrobeId,image,rows,until,restartProbe,artifacts,showList});return;}
    if(quoteDuplicate){await duplicateCase({t,phone,computer,offer,iid,pid,until,image,rows,artifacts,db,ownerUid,restartProbe,globalBefore});return;}
    if(quoteVariants){await variantsCase({t,phone,computer,offer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,restartProbe,artifacts,globalBefore,env});return;}
    if(quotePromotion||quoteStaging){
     if(quotePromotion)await until(async()=>(await image(phone)).outbox.find(op=>op.key===queued[0].key)?.phase==='verified');
     await (quotePromotion?promotionCase:stagingCase)({t,phone,computer,offer,iid,pid,wardrobeId,db,ownerUid,until,image,rows,showList,openRoom,restartProbe,artifacts,globalBefore,env});
     return;
    }
    if(quoteAcceptance){
     await until(async()=>(await image(phone)).outbox.find(op=>op.key===queued[0].key)?.phase==='verified').catch(async error=>{
      const head=await f.runTransaction(db,async tx=>{const snapshot=await tx.get(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid));return snapshot.exists()?snapshot.data():null;},{maxAttempts:1});
      t.diagnostic('Quote server evidence before acceptance: '+JSON.stringify({exists:!!head,revisionId:head?.revisionId,generation:head?.generation,operations:(await image(phone)).outbox.filter(row=>row.scope===queued[0].scope).map(row=>({phase:row.phase,code:row.code,expected:row.expected?.revisionId}))}));
      throw error;
     });
     let active=phone.page;
     const accept=async()=>{
      await active.evaluate(()=>{
       window.normalQuoteAcceptanceResult=undefined;
       if(window.normalAcceptanceObserver)return;window.normalAcceptanceObserver=true;
       const api=window.FC.projectStatusSync,original=api.commitAcceptedSnapshot;
       api.commitAcceptedSnapshot=async function(...args){try{const result=await original.apply(this,args);window.normalQuoteAcceptanceResult=result;return result;}catch(error){window.normalQuoteAcceptanceResult={ok:false,code:error.code||error.message};throw error;}};
      });
      await active.locator('[data-quote-history-id="'+offer.id+'"]').getByRole('button',{name:'Zaakceptuj',exact:true}).click();
      await active.locator('.confirm-box').getByRole('button',{name:'Zaakceptuj ofertę',exact:true}).click();
      await active.waitForFunction(()=>window.normalQuoteAcceptanceResult!==undefined);
      return active.evaluate(()=>window.normalQuoteAcceptanceResult);
     };
     // A genuinely foreign active lease refuses before acquiring any other scope.
     const busyBefore=await image(phone),foreignBefore=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data();
     const busy=await accept();assert.equal(busy.code,'LF_QUOTE_EDITOR_BUSY');
     assert.deepEqual(await image(phone),busyBefore,'Busy scope must leave the entire local transaction image unchanged');
     assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data(),foreignBefore,'Never take over the other device');
     await active.locator('.info-box .is-success').click();
     await showList(computer.page);
     await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data().active===false);
     await active.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
     const beforeAcceptance=await image(phone);
     if(quoteAcceptanceRace){
      await active.evaluate(id=>{window.normalHoldStatusHead=id;window.normalStatusHeadCommitted=false;},pid);
      const localResult=await accept();assert.equal(localResult.ok,true);assert.equal(localResult.cloudConfirmed,false);
      await active.waitForFunction(()=>window.normalStatusHeadCommitted===true);
      const editorRef=f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId),headRef=f.doc(db,'users',ownerUid,'p0bRoomProjects',wardrobeId);
      const concurrent=await f.runTransaction(db,async tx=>{
       const editor=(await tx.get(editorRef)).data(),head=(await tx.get(headRef)).data();
       const next={...editor,deviceId:'concurrent-demo-device',deviceLabel:'Konflikt DEMO',epoch:editor.epoch+1,headRevision:head.currentRevisionId};
       tx.set(editorRef,next);return next;
      },{maxAttempts:1});
      await active.evaluate(()=>{window.normalReleaseStatusHead();return true;});
      await until(async()=>{const state=await image(phone);return state.outbox.some(row=>row.scope===wardrobeId&&row.phase==='conflict');});
      const conflicted=await image(phone),newOps=conflicted.outbox.filter(row=>!beforeAcceptance.outbox.some(old=>old.key===row.key));
      assert.equal(newOps.length,3);
      const quoteOp=newOps.find(row=>row.scope===queued[0].scope),roomConflict=newOps.find(row=>row.scope===wardrobeId);
      assert.equal(roomConflict.code,'LF_EDITOR_CONFLICT');assert.equal(quoteOp.phase,'queued');assert.equal(quoteOp.receipt,undefined);
      assert.equal(JSON.parse(rows(conflicted).fc_quote_snapshots_v1).find(row=>row.id===offer.id).meta.selectedByClient,true,'The complete locally confirmed intention remains recoverable');
      assert.deepEqual((await f.getDoc(headRef)).data(),wardrobeHead,'The obsolete epoch must not publish');
      assert.equal((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data().generation,1,'A participant conflict must fence the acceptance publication');
      const committedFirst=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data();
      await active.context().tracing.stop({path:path.join(artifacts,'acceptance-conflict.zip')});
      await restartProbe(phone,{crash:true});active=phone.page;
      await active.context().tracing.start({screenshots:true,snapshots:true,sources:true});
      const after=await image(phone);
      assert.deepEqual(rows(after).fc_quote_snapshots_v1,rows(conflicted).fc_quote_snapshots_v1);
      for(const op of newOps)assert.ok(after.outbox.some(row=>row.key===op.key&&row.phase===op.phase));
      assert.deepEqual((await f.getDoc(editorRef)).data(),concurrent,'Restart must not take over the foreign editor');
      assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data(),committedFirst,'Restart must not republish the confirmed participant');
      assert.equal((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data().generation,1);
      assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
      t.diagnostic('Real post-commit emulator epoch conflict preserves the complete local intention, denies obsolete publication, fences quote ACK and survives restart without takeover');
      return;
     }
     await active.evaluate(()=>{
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,...args){
       const result=original.call(this,value,...args);
       if(this.name==='control'&&value?.key==='application'&&JSON.parse(value.rows.fc_quote_snapshots_v1||'[]').some(row=>row.meta?.selectedByClient)){
        IDBObjectStore.prototype.put=original;queueMicrotask(()=>this.transaction.abort());
       }
       return result;
      };
     });
     const aborted=await accept();assert.equal(aborted.code,'LF_IDB_ABORTED');
     const afterAbort=await image(phone);
     assert.deepEqual(rows(afterAbort),rows(beforeAcceptance),'Aborted acceptance must roll back both projects and history');
     assert.deepEqual(afterAbort.outbox,beforeAcceptance.outbox,'No partial outbox operation after abort');
     for(const id of [pid,wardrobeId])assert.equal(afterAbort.replicas.find(row=>row.key===id).json,beforeAcceptance.replicas.find(row=>row.key===id).json);
     await active.locator('.info-box .is-success').click();
     await active.context().tracing.stop({path:path.join(artifacts,'acceptance-abort.zip')});
     await restartProbe(phone,{crash:true});active=phone.page;
     await active.context().tracing.start({screenshots:true,snapshots:true,sources:true});
     await active.locator('[data-action="tab"][data-tab="wycena"]').filter({visible:true}).first().click();
     await active.locator('[data-quote-history-id="'+offer.id+'"]').waitFor();
     const afterAbortRestart=await image(phone);
     for(const key of ['fc_projects_v1','fc_quote_snapshots_v1','fc_investors_v1'])assert.equal(rows(afterAbortRestart)[key],rows(beforeAcceptance)[key]);
     await active.evaluate(()=>{window.normalLoseQuoteAck=true;window.normalQuoteHeadCommitted=false;});
     const result=await accept(),afterAcceptance=await image(phone);
     assert.equal(result?.ok,true,'Real combined acceptance must durably commit: '+JSON.stringify(result));
     const accepted=JSON.parse(rows(afterAcceptance).fc_quote_snapshots_v1).find(row=>row.id===offer.id);
     assert.equal(accepted.meta.selectedByClient,true);
     assert.deepEqual(accepted.lines,offer.lines);assert.deepEqual(accepted.scope,offer.scope);assert.deepEqual(accepted.totals,offer.totals);
     for(const id of [pid,wardrobeId]){
      const record=JSON.parse(rows(afterAcceptance).fc_projects_v1).find(row=>row.id===id);
      assert.equal(record.status,'zaakceptowany');assert.equal(record.projectData.meta.roomDefs[id].projectStatus,'zaakceptowany');
      assert.deepEqual(record.projectData[id],JSON.parse(rows(beforeAcceptance).fc_projects_v1).find(row=>row.id===id).projectData[id]);
     }
     const operations=afterAcceptance.outbox.filter(row=>!beforeAcceptance.outbox.some(old=>old.key===row.key));
     assert.equal(operations.length,3);assert.equal(new Set(operations.map(row=>row.applicationHash)).size,1);
     const acceptance=operations.find(row=>row.scope===queued[0].scope);assert.equal(acceptance.dependencies.length,2);
     for(const dependency of acceptance.dependencies)assert.ok(operations.some(row=>row.key===dependency.key&&row.scope===dependency.scope&&row.hash===dependency.hash));
     await active.waitForFunction(()=>window.normalQuoteHeadCommitted===true);
     const beforeLostAck=await image(phone);
     for(const dependency of acceptance.dependencies)assert.equal(beforeLostAck.outbox.find(row=>row.key===dependency.key).phase,'verified','Quote acceptance may publish only after participant ACK');
     await active.context().setOffline(true);await active.waitForFunction(()=>!navigator.onLine);
     await active.evaluate(()=>{window.normalReleaseQuoteAckLoss();return true;});
     await until(async()=>(await image(phone)).outbox.find(row=>row.key===acceptance.key)?.phase==='uncertain');
     const acceptedHead=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data();assert.equal(acceptedHead.generation,2);
     await active.context().tracing.stop({path:path.join(artifacts,'acceptance-uncertain.zip')});
     await restartProbe(phone,{crash:true});active=phone.page;
     await active.context().tracing.start({screenshots:true,snapshots:true,sources:true});
     await until(async()=>(await image(phone)).outbox.find(row=>row.key===acceptance.key)?.phase==='verified');
     const recovered=await image(phone);
     assert.deepEqual(JSON.parse(rows(recovered).fc_quote_snapshots_v1).find(row=>row.id===offer.id),accepted);
     assert.equal(recovered.outbox.filter(row=>operations.some(op=>op.key===row.key)).length,3);
     assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data(),acceptedHead,'Restart must reconcile without a second acceptance publication');
     await until(async()=>{const received=await image(computer);return JSON.parse(rows(received).fc_quote_snapshots_v1).some(row=>row.id===offer.id&&row.meta.selectedByClient)&&[pid,wardrobeId].every(id=>JSON.parse(rows(received).fc_projects_v1).find(row=>row.id===id)?.status==='zaakceptowany');});
     for(const id of [pid,wardrobeId])assert.equal((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',id))).data().generation,(id===pid?confirmedHead:wardrobeHead).generation+1);
     assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
     t.diagnostic('Combined acceptance: foreign lease refusal, atomic IDB abort, restart, both statuses, participant ACK, lost quote ACK and restart without partial writes or duplicates');
     return;
    }
    await page.waitForFunction(()=>window.normalQuoteHeadCommitted===true);
    await page.context().setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
    await page.evaluate(()=>{window.normalReleaseQuoteAckLoss();return true;});
    await until(async()=>(await image(phone)).outbox.find(op=>op.key===queued[0].key)?.phase==='uncertain');
    const uncertain=await image(phone);assert.equal(uncertain.outbox.find(op=>op.key===queued[0].key).receipt,undefined);
    const quoteHead=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data();assert.equal(quoteHead.generation,1);
    await until(async()=>JSON.parse(rows(await image(computer)).fc_quote_snapshots_v1||'[]').some(row=>row.id===offer.id));
    await page.context().tracing.stop({path:path.join(artifacts,'quote-before-crash.zip')});
    await restartProbe(phone,{crash:true});
    await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
    await until(async()=>(await image(phone)).outbox.find(op=>op.key===queued[0].key)?.phase==='verified');
    const restarted=await image(phone);
    assert.deepEqual(JSON.parse(rows(restarted).fc_quote_snapshots_v1).find(row=>row.id===offer.id),offer,'Frozen quote history must survive SIGKILL and ACK reconciliation');
    assert.equal(restarted.outbox.filter(row=>row.scope===queued[0].scope).length,1);
    assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomQuotes',iid))).data(),quoteHead,'ACK reconciliation must not publish again');
    await env.withSecurityRulesDisabled(async context=>assert.equal((await f.getDocs(f.collection(context.firestore(),'users',ownerUid,'p0bRoomQuotes',iid,'revisions'))).size,1));
    t.diagnostic('Combined PCV equals per-room sums with real addresses; one immutable quote revision, lost ACK and SIGKILL reconcile without duplicate publication');
    assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data(),confirmedHead);
    assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',wardrobeId))).data(),wardrobeHead);
    assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
    await showList(computer.page);await showList(phone.page);
    await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',wardrobeId))).data().active===false);
    const activePage=phone.page;
    await until(async()=>{const registry=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();return Object.values(registry.projects).every(held=>held===false)&&Object.keys(registry.visits).length===0;});
    const beforeVisit=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();
    await activePage.evaluate(()=>{window.normalLoseVisitAck=true;window.normalVisitCommitted=false;});
    await activePage.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();
    await activePage.waitForFunction(()=>{
     const state=window.FC.applicationStartup.inspect();
     return !state.transactionPending&&!state.incomingPending&&
      (window.uiState.entry==='rooms'||!!document.querySelector('.info-box')?.getClientRects().length);
    });
    const lostVisit=await activePage.evaluate(()=>window.normalVisitCommitted);
    assert.equal(lostVisit?.generation,beforeVisit.generation+1,'Visit ACK is lost only after the real server commit');
    assert.equal(await activePage.locator('[data-investor-action="projects"]').isVisible(),true,'A confirmed own visit must reconcile a lost ACK before local navigation');
    const afterVisit=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();
    assert.equal(afterVisit.generation,beforeVisit.generation+1,'Visit reconciliation must not publish twice');
    assert.deepEqual(afterVisit.visits,lostVisit.visits);
    assert.equal(Object.values(afterVisit.visits).length,1);assert.equal(Object.values(afterVisit.visits)[0].label,'Telefon DEMO');
    await projects(activePage);
    await activePage.locator('#invProjectStatus_'+wardrobeId+'Launch button').click();
    await activePage.locator('.rozrys-choice-modal .rozrys-choice-option').filter({hasText:/^Pomiar$/}).click();
    await activePage.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
    const changedStatus=await image(phone),statusProject=JSON.parse(rows(changedStatus).fc_projects_v1).find(row=>row.id===wardrobeId);
    assert.equal(statusProject.projectData.meta.roomDefs[wardrobeId].projectStatus,'pomiar');
    assert.deepEqual(JSON.parse(rows(changedStatus).fc_projects_v1).find(row=>row.id===pid),JSON.parse(rows(restarted).fc_projects_v1).find(row=>row.id===pid));
    assert.equal(rows(changedStatus).fc_quote_snapshots_v1,rows(restarted).fc_quote_snapshots_v1,'Single room status must preserve combined frozen history');
    await until(async()=>(await image(phone)).outbox.filter(row=>row.scope===wardrobeId).every(row=>row.phase==='verified'));
    const statusHead=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',wardrobeId))).data();
    await projects(activePage);await activePage.locator('[data-investor-action="manage-rooms"]').filter({visible:true}).click();
    const manage=activePage.locator('.room-registry-manage-modal');
    const removeRow=manage.locator('.room-registry-manage-row').filter({has:activePage.locator('input[value="P0B wardrobe"]')});
    await removeRow.getByRole('button',{name:'Usuń',exact:true}).click();
    await activePage.locator('.confirm-box .is-danger').click();
    await manage.locator('.panel-box-form__footer').getByRole('button',{name:'Zapisz',exact:true}).click();
    await activePage.locator('.confirm-box .is-success').click();
    await activePage.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
    const removed=await image(phone),removedProject=JSON.parse(rows(removed).fc_projects_v1).find(row=>row.id===wardrobeId);
    assert.equal(removedProject.meta.roomProject.removed,true);
    assert.deepEqual(removedProject.projectData,statusProject.projectData,'Removing a room hides its active record without erasing technical history');
    assert.equal(rows(removed).fc_quote_snapshots_v1,rows(restarted).fc_quote_snapshots_v1);
    await until(async()=>(await image(phone)).outbox.filter(row=>row.scope===wardrobeId).every(row=>row.phase==='verified'));
    const deletedHead=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',wardrobeId))).data();
    assert.equal(deletedHead.roomDeleted,true);assert.equal(deletedHead.generation,statusHead.generation+1);
    await until(async()=>JSON.parse(rows(await image(computer)).fc_projects_v1).find(row=>row.id===wardrobeId)?.meta.roomProject.removed===true);
    assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data(),confirmedHead);
    assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
    t.diagnostic('Real single-room status and deletion preserve the other room, combined quote history and global data');
    return;
   }
   // A verified sender ACK precedes the reader's asynchronous application refresh.
   // Observe the other room's exact revision and completed projection before navigating.
   await until(async()=>(await image(phone)).replicas.find(row=>row.key===wardrobeId)?.base?.currentRevisionId===wardrobeHead.currentRevisionId);
   await page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending);
   await page.locator('[data-action="tab"][data-tab="inwestor"]').click();
   await page.waitForFunction(()=>window.uiState.activeTab==='inwestor'&&!window.FC.applicationStartup.inspect().transactionPending&&!window.FC.applicationStartup.inspect().incomingPending);
   await openRoom(phone,roomId);
   await page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
   await page.context().setOffline(true);await page.waitForFunction(()=>navigator.onLine===false);
   await showList(computer.page);
   await computer.page.locator('[data-action="open-investor"][data-inv-id="'+iid+'"]').click();
   await computer.page.waitForFunction(iid=>window.uiState?.currentInvestorId===iid&&window.uiState.entry==='rooms'&&!window.FC.applicationStartup.inspect().transactionPending,iid);
   await openRoom(computer,roomId);
   const recovery=computer.page.locator('.panel-box').filter({hasText:'Odzyskaj projekt'});
   await recovery.waitFor();assert.ok((await recovery.innerText()).includes('Telefon DEMO'));
   const recover=async(device,variant,value,name,expectedFailure)=>{
    const target=device.page,privateTrace=device===phone;
    if(privateTrace)await target.context().tracing.stop();
    try{
     const moved=!expectedFailure&&(value===pin||value===undefined)?target.waitForEvent('domcontentloaded'):null;
     if(await target.getByLabel('PIN przejęcia').count()){assert.equal(typeof value,'string');await target.getByLabel('PIN przejęcia').fill(value);}
     if(name)await target.getByLabel('Nazwa kopii pomieszczenia').fill(name);
     await target.getByRole('button',{name:variant==='room-copy'?'Zachowaj kopię pomieszczenia':'Pobierz najnowszą wersję',exact:true}).click();
     await target.locator('.confirm-box').getByRole('button',{name:'Odzyskaj projekt',exact:true}).click();
     if(moved)await moved;else await target.getByRole('status').filter({hasText:expectedFailure||'LF_P0B_PIN_INCORRECT'}).waitFor();
    }finally{if(privateTrace&&await target.getByLabel('PIN przejęcia').count())await target.getByLabel('PIN przejęcia').fill('');if(privateTrace)await target.context().tracing.start({screenshots:true,snapshots:true,sources:true});}
   };
   await recover(computer,'latest',String((Number(pin)+1)%10000).padStart(4,'0'));
   await recovery.getByRole('status').filter({hasText:'LF_P0B_PIN_INCORRECT'}).waitFor();
   assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid))).data(),lease);
   const computerReload=computer.page.waitForEvent('domcontentloaded');
   await recover(computer,'latest',pin);
   await computerReload;await login(computer);
   const taken=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid))).data();
   assert.equal(taken.deviceLabel,'Komputer DEMO');assert.equal(taken.epoch,lease.epoch+1);
   await until(async()=>{const presence=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid,'presence','current'))).data();return presence?.deviceId===taken.deviceId&&presence?.epoch===taken.epoch;});
   assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data(),confirmedHead,'Recovered ownership heartbeat must not publish a project revision');
   assert.equal(await page.evaluate(()=>navigator.onLine),false,'Offline device must remain offline throughout the other device takeover');
   await page.locator('.cab-actions [data-act="edit"]').first().click();
   await page.locator('#cmWidth').fill('67');await page.locator('#cabinetModalSave').click();await page.locator('#cabinetModal').waitFor({state:'hidden'});
   await saveProject(page,{flush:false});
   const offline=await image(phone),unsent=offline.outbox.find(row=>row.scope===pid&&row.phase==='queued');
   assert.ok(unsent);assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data(),confirmedHead);
   await page.context().tracing.stop({path:path.join(artifacts,'before-restart.zip')});
   await restartProbe(phone,{crash:true});
   const reopened=phone.page;await reopened.context().tracing.start({screenshots:true,snapshots:true,sources:true});
   await reopened.locator('.panel-box').filter({hasText:'Odzyskaj projekt'}).waitFor();
   const sourceBeforeAbort=await image(phone);
   const recoveredIdentity=await nativeFixtureState(phone);
   assert.deepEqual(recoveredIdentity.binding,baseline.binding,'SIGKILL must keep the established installation');
   assert.deepEqual(recoveredIdentity.raw,baseline.raw);
   assert.equal(recoveredIdentity.nativeLabel,'Telefon DEMO','Recovery must use the durable local device name');
   assert.equal(await reopened.evaluate(()=>window.FC.localDeviceLabel.read()),'Telefon DEMO');
   await reopened.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,...args){
     const result=original.call(this,value,...args);
     if(this.name==='control'&&value?.key==='application'&&JSON.parse(value.rows.fc_projects_v1||'[]').some(row=>row.title==='Kuchnia odzyskana')){
      IDBObjectStore.prototype.put=original;queueMicrotask(()=>this.transaction.abort());
     }
     return result;
    };
   });
   await recover(phone,'room-copy',pin,'Kuchnia odzyskana','LF_IDB_ABORTED');
   const aborted=await image(phone);
   assert.deepEqual(rows(aborted),rows(sourceBeforeAbort));assert.deepEqual(aborted.outbox,sourceBeforeAbort.outbox);assert.deepEqual(aborted.replicas,sourceBeforeAbort.replicas);
   const takeoverAfterAbort=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid))).data();
   assert.equal(takeoverAfterAbort.deviceLabel,'Telefon DEMO','Server takeover completed before the aborted local checkpoint');
   assert.equal(takeoverAfterAbort.deviceId,baseline.binding.deviceId);
   assert.notEqual(takeoverAfterAbort.deviceId,taken.deviceId);
   assert.equal(takeoverAfterAbort.epoch,taken.epoch+1);
   assert.equal(takeoverAfterAbort.active,true);
   assert.equal(takeoverAfterAbort.headRevision,confirmedHead.currentRevisionId);
   await reopened.context().tracing.stop({path:path.join(artifacts,'aborted-recovery.zip')});
   await restartProbe(phone,{crash:true});
   await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
   await until(async()=>{const state=await image(phone);return state.outbox.some(row=>row.key.startsWith('room-copy-')&&row.phase==='verified');});
   const copied=await image(phone),allProjects=JSON.parse(rows(copied).fc_projects_v1),latestProject=allProjects.find(row=>row.id===pid);
   const recovered=allProjects.find(row=>row.title==='Kuchnia odzyskana'),recoveredId=recovered?.id;
   assert.ok(recoveredId);assert.notEqual(recoveredId,roomId);
   assert.deepEqual(JSON.parse(rows(copied).fc_investors_v1).find(row=>row.id===iid).rooms.map(room=>room.id).sort(),allProjects.filter(row=>row.investorId===iid&&row.meta.roomProject.removed!==true).map(row=>row.id).sort(),'Room mirror must include the durable copy without changing the shared contact');
   assert.equal(recovered.meta.roomProject.roomId,recoveredId);assert.deepEqual(recovered.projectData.meta.roomOrder,[recoveredId]);
   assert.equal(latestProject.projectData[roomId].settings.roomHeight,project.projectData[roomId].settings.roomHeight);
   assert.equal(recovered.projectData[recoveredId].settings.roomHeight,project.projectData[roomId].settings.roomHeight);
   assert.equal(recovered.projectData[recoveredId].cabinets[0].width,67);
   assert.equal(latestProject.projectData[roomId].cabinets[0].width,66);
   assert.notEqual(recovered.projectData[recoveredId].cabinets[0].id,sourceCabinet.id);
   assert.ok(copied.protected.some(row=>row.key.startsWith('recovery-')&&JSON.parse(row.json).operations.some(op=>op.key===unsent.key)));
   assert.equal(copied.outbox.filter(row=>row.key.startsWith('room-copy-')).length,1);
   assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',pid))).data(),confirmedHead,'Recovery must not publish the copy into the original scope');
   assert.equal((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',recoveredId))).data().generation,1);
   assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomProjects',wardrobeId))).data(),wardrobeHead,'Kitchen recovery must not overwrite the concurrently saved wardrobe');
   assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
   t.diagnostic('Real PIN refusal/takeover, offline durable save, SIGKILL, room copy with new IDs and one verified publication');
   await showList(phone.page);
   await until(async()=>(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid))).data().active===false);
   await openRoom(computer,roomId);
   await computer.page.locator('.panel-box').filter({hasText:'Odzyskaj projekt'}).waitFor();
   assert.equal(await computer.page.getByLabel('PIN przejęcia').count(),0);
   await recover(computer,'latest',undefined);await login(computer);
   await until(async()=>JSON.parse(rows(await image(computer)).fc_projects_v1).some(row=>row.id===recoveredId));
   assert.equal(JSON.parse(rows(await image(computer)).fc_projects_v1).find(row=>row.id===recoveredId).projectData[recoveredId].cabinets[0].width,67);
   await showList(computer.page);
   await until(async()=>{const record=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();return Object.keys(record.visits).length===0&&Object.values(record.projects).every(value=>value===false);});
   const removal=computer.page.locator('[data-action="remove-investor-from-list"]').filter({visible:true}).first();
   await removal.click();const check=computer.page.locator('[data-investor-delete-id="'+iid+'"]');await check.waitFor();
   await computer.page.waitForFunction(iid=>document.querySelector('[data-investor-delete-id="'+iid+'"]')?.disabled===false,iid);
   await check.check();await removal.click();
   await computer.page.locator('.confirm-box').getByRole('button',{name:'Anuluj',exact:true}).click();
   assert.equal((await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data().deletionId,'');
   await removal.click();await computer.page.locator('.confirm-box').getByRole('button',{name:'Usuń',exact:true}).click();
   const deletionNotice=computer.page.locator('.info-box');await deletionNotice.waitFor();assert.match(await deletionNotice.innerText(),/Usunięto inwestorów/);await deletionNotice.locator('.is-success').click();
   await until(async()=>[phone,computer].every(Boolean)&&JSON.parse(rows(await image(phone)).fc_investors_v1).length===0&&JSON.parse(rows(await image(computer)).fc_investors_v1).length===0);
   const terminal=(await f.getDoc(f.doc(db,'users',ownerUid,'p0bRoomInvestors',iid))).data();assert.ok(terminal.deletionId);
   for(const d of [phone,computer]){const local=await image(d);assert.equal(JSON.parse(rows(local).fc_projects_v1).length,0);assert.ok(local.protected.some(row=>JSON.parse(row.json).kind==='p0b-deletion-quarantine'));}
   await assertFails(f.updateDoc(f.doc(db,'users',ownerUid,'p0bRoomEditors',pid),{active:true,deviceId:taken.deviceId,epoch:taken.epoch}));
   await assertFails(f.setDoc(f.doc(db,'users',ownerUid,'localFirstProjects','legacy-resurrection'),{ownerUid,investorId:iid,projectId:pid}));
   assert.deepEqual((await f.getDoc(f.doc(db,'users',ownerUid,'globalData','current'))).data(),globalBefore);
   t.diagnostic('Free project recovery needs no PIN; real Exit releases locks/visits; Cancel and confirmed UI deletion propagate and fence stale writers');


  }catch(error){
   t.diagnostic('Primary normal failure: '+(error.stack||String(error)));
   try{
   const state=await image(phone).catch(()=>null);
   if(computer){const peer=await computer.page.evaluate(()=>({phase:window.FC.applicationStartup.inspect(),rpc:window.normalRpcTimeline,pendingRpc:window.normalPendingRpc,sdkErrors:window.normalSdkErrors,body:document.body.innerText,session:window.FC.session&&Object.fromEntries(Object.entries(window.FC.session).filter(([,v])=>typeof v!=='function')),ui:window.uiState,recovery:typeof window.FC.projectRecovery,registry:window.FC.applicationRegistry}));fs.writeFileSync(path.join(artifacts,'peer.json'),JSON.stringify({peer,state:await image(computer).catch(()=>null)},null,2));await computer.page.screenshot({path:path.join(artifacts,'peer.png')});t.diagnostic('Peer: '+JSON.stringify(peer));}
   const diagnostic=await phone.page.evaluate(()=>({phase:window.FC.applicationStartup.inspect(),notice:document.querySelector('.info-box')?.innerText,storage:window.FC.storage?.getLastWriteError()?.error?.code,storageKey:window.FC.storage?.getLastWriteError()?.key,session:window.FC.session&&Object.fromEntries(Object.entries(window.FC.session).filter(([k,v])=>typeof v!=='function')),ui:window.uiState,ram:window.projectData}));
   fs.writeFileSync(path.join(artifacts,'failure.json'),JSON.stringify({diagnostic,state},null,2));
   await phone.page.screenshot({path:path.join(artifacts,'failure.png')});
   await phone.page.context().tracing.stop({path:path.join(artifacts,'failure.zip')}).catch(()=>{});t.diagnostic(artifacts+' '+JSON.stringify(diagnostic));
   }catch(diagnosticError){t.diagnostic('Additional failure diagnostics unavailable: '+diagnosticError.message);}
   throw error;
  }
  await phone.page.context().tracing.stop();
 }});
}
test('P0-B normal DEMO clean registry: real new investor, two profiles and durable independent contact',t=>cleanApplication(t));
test('P0-B room quote: real combined selection, durable history, independent ACK and protected rooms',t=>cleanApplication(t,{quoteProbe:true}));
test('P0-B room quote variants: named second variant preserves history and ACK after restart',t=>cleanApplication(t,{quoteProbe:true,quoteVariants:true}));
test('P0-B room quote promotion: combined preliminary becomes final atomically through real UI',t=>cleanApplication(t,{quoteProbe:true,quotePromotion:true}));
test('P0-B room quote staging: interrupted immutable publication resumes after SIGKILL',t=>cleanApplication(t,{quoteProbe:true,quoteStaging:true}));
test('P0-B room quote acceptance: real combined acceptance preserves frozen sources and prices',t=>cleanApplication(t,{quoteProbe:true,quoteAcceptance:true}));
test('P0-B room quote acceptance conflict: a changed epoch fences publication and preserves recovery',t=>cleanApplication(t,{quoteProbe:true,quoteAcceptance:true,quoteAcceptanceRace:true}));

test('P0-B signed DEMO clean registry: real new investor, two profiles and durable independent contact',t=>cleanApplication(t,{deployment:true}));


test('P0-B signed room deployment: combined quote and immutable history survive restart and lost ACK',t=>cleanApplication(t,{deployment:true,quoteProbe:true,quoteReadBudget:true}));

test('P1 normal DEMO idle batching: real Save, two-minute timer and independent room ACK',t=>cleanApplication(t,{p1:'idle'}));
test('P1 normal DEMO delivery: Exit, offline restart, crash ACK and durable pending queue',t=>cleanApplication(t,{p1:'delivery'}));

test('P1 signed DEMO quote barrier: pending room Save requires confirmed immutable source pins',t=>cleanApplication(t,{p1:'quote',deployment:true}));

test('P1 normal DEMO offline quote: restart of a pending room Save preserves immutable history and ACK',t=>cleanApplication(t,{p1:'offline-quote'}));

test('P1 tab Save and proceed: real dirty room navigation stays durable',t=>cleanApplication(t,{p1:'tab-save',deployment:true}));
test('P0-B duplicate replacement: same logical offer preserves history and ACK',t=>cleanApplication(t,{quoteProbe:true,quoteDuplicate:true}));

test('P0-B quote removal single: duplicate then delete and recalculate preserves room sources',t=>cleanApplication(t,{quoteProbe:true,quoteRemoval:'single'}));
test('P0-B quote removal combined: duplicate then delete and recalculate preserves room sources',t=>cleanApplication(t,{quoteProbe:true,quoteRemoval:'combined'}));

test('P0-B signed desktop presence: untrusted background renews real main lease and room entry',t=>cleanApplication(t,{deployment:true,presenceReconnect:true}));

test('P0-B signed background resume: durable drafts and automatic offline Exit ACK',t=>cleanApplication(t,{deployment:true,accessResume:true}));

test('P0-B phone quote flow: fresh receiver, immediate history and cabinet variant',t=>cleanApplication(t,{deployment:true,quoteProbe:true,quoteFilm:true}));

test('P0-B phone quote flow: calculate overlaps durable deletion without resurrection',t=>cleanApplication(t,{quoteProbe:true,quoteFilm:'rapid'}));

test('P0-B manual quote: header Sync and explicit historical pricing with PIN release',t=>cleanApplication(t,{deployment:true,quoteProbe:true,manualQuote:'normal'}));
test('P0-B manual quote: SIGKILL after server release resumes the durable intent without duplication',t=>cleanApplication(t,{deployment:true,quoteProbe:true,manualQuote:'crash'}));

test('P0-B startup draft: cold desktop restart with empty native catalogs preserves durable room after takeover',t=>cleanApplication(t,{deployment:true,startupDraft:true}));

test('P0-B manual quote: reservation through room selection, peer decision and publication',t=>cleanApplication(t,{p1:'reservation'}));
