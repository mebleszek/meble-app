// Real runtime, native IDB and SDK/Rules on loopback; only Google enrollment is synthetic.
import assert from 'node:assert/strict';
import {doc,getDoc,getDocs,collection,deleteDoc} from 'firebase/firestore';
export async function runBackgroundRoundTrip(t,{phone,device,enable,restart,touch,env,uid,pid,iid,room,catalogs}){
 const server=env.authenticatedContext(uid,{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 async function until(d,fn,label){console.log('BACKGROUND STEP: '+label+' '+Math.round(performance.now())+'ms');try{await d.page.waitForFunction(fn,{pid,room},{timeout:fn===ready?120000:45000});}catch(error){throw Error(label+' '+JSON.stringify(await d.page.evaluate(async()=>({state:document.body.dataset,app:window.FC.applicationStartup.inspect(),locks:await navigator.locks.query(),rpc:window.normalRpcTimeline,pendingRpc:window.normalPendingRpc,sdk:window.normalSdkErrors,connection:window.normalConnectionError,info:document.querySelector('.info-box')?.textContent,ui:window.uiState,session:{active:window.FC.session.active,durable:window.FC.session.durable,code:window.FC.session.lastError?.code}}))));}}
 const ready=({pid})=>window.FC.applicationStartup.inspect().backgroundSync?.state==='confirmed'&&!window.FC.applicationStartup.inspect().transactionPending&&window.FC.projectStore.readAll().some(p=>p.id===pid);
 const proof=d=>d.page.evaluate(async()=>{const app=window.FC.applicationStartup.inspect();const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');const receipt=JSON.parse(window.readNormalSource('meble_application_authority_v1'));const store=await openLocalFirstStore({...receipt,indexedDB,locks:navigator.locks});try{const image=await store.readApplication(),source=await store.readPreservedSource();return {image,source,globals:await store.snapshot('globals'),projects:await Promise.all(JSON.parse(image.rows.fc_projects_v1||'[]').map(p=>store.snapshot(p.id))),app};}finally{store.close();}});
 await until(phone,ready,'Phone first publication');
 const first=await proof(phone);assert.equal(first.projects.length,2);assert.ok(first.projects.every(p=>p.operations.every(o=>o.phase==='verified')));assert.equal(first.app.cloudConfirmed,true);
 assert.equal((await getDoc(doc(server,'users',uid,'localFirstProjects',pid))).exists(),true);
 t.diagnostic('PASS local ready precedes background admission; existing local projects published through the durable queue with independent ACK');
 const computer=await device('computer');await enable(computer);await until(computer,ready,'Computer independent receive');
 const initial=await computer.page.evaluate(({pid})=>window.FC.projectStore.getById(pid),{pid});assert.equal(initial.projectData.meta.futureOwnedField.exact,7.125);
 assert.equal((await computer.page.evaluate(()=>JSON.parse(localStorage.getItem('fc_quote_snapshots_v1')||'[]'))).length,1);
 const expectedGlobals=await phone.page.evaluate(()=>window.FC.globalDataContract.capture(localStorage,Object.keys(window.FC.globalDataContract.schemas)).model);
 assert.deepEqual(await computer.page.evaluate(()=>window.FC.globalDataContract.capture(localStorage,Object.keys(window.FC.globalDataContract.schemas)).model),expectedGlobals);
 async function open(d){await d.page.evaluate(async({iid})=>{const args={element:{getAttribute:()=>iid}};if(await window.FC.actions.dispatch('open-investor',args)!==true)throw Error('Open investor refused');},{iid});await touch(d,'[data-action="open-room"][data-room="'+room+'"]');await until(d,()=>window.FC.session.active&&window.FC.session.durable&&!window.FC.applicationStartup.inspect().transactionPending,'Owned editor');}
 async function edit(d,shelves){await d.page.evaluate(async({room,shelves})=>{const fc=window.FC;await fc.applicationWrite.project(()=>{if(fc.session.begin(room)!==true)return false;window.projectData[room].cabinets[0].details.shelves=shelves;const saved=fc.project.saveConfirmed(window.projectData);if(!saved.ok)return false;window.projectData=saved.project;fc.views.refreshSessionButtons();return true;});},{room,shelves});await touch(d,'#sessionSave');await until(d,()=>!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending,'Confirmed local Save');}
 async function exit(d){if(await d.page.locator('.info-box button').count())await d.page.locator('.info-box button').click();await touch(d,'#sessionCancel');await until(d,()=>window.uiState.entry==='investorsList','Explicit handover');await until(d,ready,'Verified transfer');}
 await open(phone);
 await computer.page.evaluate(async({iid})=>{if(await window.FC.actions.dispatch('open-investor',{element:{getAttribute:()=>iid}})!==true)throw Error('Second-device investor refused');},{iid});
 const lockedBefore=await proof(computer);
 assert.equal(await computer.page.evaluate(({room})=>window.FC.actions.dispatch('open-room',{element:document.querySelector('[data-action="open-room"][data-room="'+room+'"]')}),{room}),false);
 assert.match(await computer.page.locator('.info-box').innerText(),/LF_EDITOR_BUSY_OR_HEAD_CHANGED/);assert.equal(await computer.page.evaluate(()=>window.FC.session.active),false);
 const lockedAfter=await proof(computer);assert.deepEqual(lockedAfter.image,lockedBefore.image);assert.deepEqual(lockedAfter.projects,lockedBefore.projects);assert.deepEqual(lockedAfter.source,lockedBefore.source);
 await computer.page.locator('.info-box button').click();t.diagnostic('PASS another device cannot open the active editor or mutate its image, replicas, outbox or preserved source');
 await computer.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list',{}));await until(computer,()=>!window.FC.applicationStartup.inspect().transactionPending,'Receiver list');await touch(computer,'[data-action="create-investor"]');await computer.page.fill('#invName','Synthetic unsaved form');
 const formBefore=await proof(computer);assert.equal(formBefore.app.cloudConfirmed,false,'Unsaved form is never a claimed cloud ACK');
 await edit(phone,4);await exit(phone);
 await until(computer,()=>['LF_ACTIVE_FORM_PROTECTED','LF_ACTIVE_RAM_PROTECTED'].includes(window.FC.applicationStartup.inspect().backgroundSync?.code),'Incoming protects unsaved form');
 assert.equal(await computer.page.inputValue('#invName'),'Synthetic unsaved form');assert.deepEqual((await proof(computer)).image,formBefore.image);
 await touch(computer,'[data-investor-action="cancel"]');await computer.page.waitForSelector('.confirm-box .is-danger');await touch(computer,'.confirm-box .is-danger');
 await until(computer,({pid,room})=>window.FC.projectStore.getById(pid)?.projectData[room].cabinets[0].details.shelves===4,'Phone to computer');
 t.diagnostic('PASS incoming revision waits for conscious dismissal of an unsaved native form, without refresh or image/RAM loss');
 await open(computer);await edit(computer,5);await exit(computer);
 await until(phone,({pid,room})=>window.FC.projectStore.getById(pid)?.projectData[room].cabinets[0].details.shelves===5,'Computer to phone');
 t.diagnostic('PASS two real profiles: phone → server → computer → server → phone, same project and owner, unchanged catalogs');
 await phone.page.check('#main-trust-phone');await until(phone,()=>window.normalConnectionEpoch>=2,'Trusted persisted Google session');await until(phone,ready,'Trusted transport ready');
 await open(phone);await phone.page.context().setOffline(true);assert.equal(await phone.page.evaluate(()=>navigator.onLine),false);await edit(phone,6);
 const offline=await proof(phone);assert.equal(offline.app.cloudConfirmed,false);assert.ok(offline.projects.find(p=>p.replica?.key===pid).operations.some(o=>o.phase==='queued'));
 await phone.page.exposeFunction('backgroundCutNetwork',()=>phone.page.context().setOffline(true));
 await phone.page.evaluate(()=>{window.backgroundLoseAck=true;});await phone.page.context().setOffline(false);await phone.page.waitForFunction(()=>navigator.onLine===true);try{await phone.page.evaluate(()=>window.FC.applicationStartup.refresh());}catch(error){throw Error('Offline reauthorization '+JSON.stringify(await phone.page.evaluate(()=>({app:window.FC?.applicationStartup?.inspect(),errors:window.normalSdkErrors,connection:window.normalConnectionError,online:navigator.onLine,state:document.body.dataset}))));}
 await until(phone,()=>window.backgroundDroppedAck===true,'Lost ACK after committed publication');
 let uncertain;for(let i=0;i<200;i++){uncertain=await proof(phone);if(uncertain.projects.find(p=>p.replica?.key===pid).operations.some(o=>o.phase==='uncertain'))break;await new Promise(r=>setTimeout(r,25));}
 assert.ok(uncertain.projects.find(p=>p.replica?.key===pid).operations.some(o=>o.phase==='uncertain'));
 assert.equal(await phone.page.evaluate(()=>normalGoogleLogins),1,'Background reconnect reuses its admitted Google session');
 const serverBeforeRestart=(await getDoc(doc(server,'users',uid,'localFirstProjects',pid))).data();
 await restart(phone,{offline:true,crash:true});assert.equal(await phone.page.evaluate(()=>navigator.onLine),false);assert.equal(await phone.page.evaluate(()=>popupCalls),0);
 const cold=await proof(phone);assert.ok(cold.projects.find(p=>p.replica?.key===pid).operations.some(o=>o.phase==='uncertain'));assert.equal(JSON.parse(cold.image.rows.fc_projects_v1).find(p=>p.id===pid).projectData[room].cabinets[0].details.shelves,6);assert.deepEqual(cold.source,first.source);
 await phone.page.context().setOffline(false);await until(phone,ready,'Independent ACK recovery after offline restart');
 assert.deepEqual((await getDoc(doc(server,'users',uid,'localFirstProjects',pid))).data(),serverBeforeRestart,'Recovery never republishes the uncertain operation');
 await until(computer,({pid,room})=>window.FC.projectStore.getById(pid)?.projectData[room].cabinets[0].details.shelves===6,'Offline queue reconnect');
 const final=await proof(phone);assert.deepEqual(final.source,first.source);assert.deepEqual(await phone.page.evaluate(()=>window.FC.globalDataContract.capture(localStorage,Object.keys(window.FC.globalDataContract.schemas)).model),expectedGlobals);
 const rows=JSON.parse(final.image.rows.fc_projects_v1);assert.equal(rows.find(p=>p.id===pid).projectData.meta.futureOwnedField.exact,7.125);assert.ok(final.projects.every(p=>p.operations.every(o=>o.phase==='verified')));
 t.diagnostic('PASS offline queue, lost ACK after actual commit, killed browser, offline cold start and independent recovery without a second publication');
 await phone.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list',{}));await until(phone,()=>uiState.entry==='investorsList'&&!window.FC.applicationStartup.inspect().transactionPending,'Local list');await phone.page.context().setOffline(true);
 await touch(phone,'[data-action="create-investor"]');await phone.page.waitForSelector('#invName');
 for(const [id,value]of Object.entries({invName:'Synthetic offline new owner',invPhone:'123456789',invCity:'Test',invEmail:'offline@example.invalid',invAddress:'Synthetic',invNotes:''}))await phone.page.fill('#'+id,value);
 await phone.page.evaluate(()=>{const el=document.getElementById('invSource');el.value=[...el.options].find(o=>o.value)?.value;el.dispatchEvent(new Event('change',{bubbles:true}));});
 await touch(phone,'#investorActionBar [data-investor-action="save"]');await phone.page.waitForSelector('.confirm-box .is-success');await touch(phone,'.confirm-box .is-success');await until(phone,()=>window.FC.projectStore.readAll().length===3&&!window.FC.applicationStartup.inspect().transactionPending,'New offline investor/project');
 await touch(phone,'[data-investor-action="add-room"]');await phone.page.waitForSelector('.panel-box input[placeholder]');await phone.page.fill('.panel-box input[placeholder]','Synthetic offline kitchen');await touch(phone,'.panel-box .btn-success');
 await touch(phone,'[data-action="open-room"][data-room^="room_"]');await until(phone,()=>window.FC.session.active&&window.FC.session.durable&&!window.FC.applicationStartup.inspect().transactionPending,'New local room');
 if(await phone.page.locator('.info-box button').count())await phone.page.locator('.info-box button').click();
 await touch(phone,'#floatingAdd');await phone.page.waitForFunction(()=>document.getElementById('cabinetModal').style.display==='flex');await touch(phone,'#cabinetTypeChoices .choice-tile:first-child');
 for(const [field,value]of Object.entries({cmWidth:'60',cmHeight:'82',cmDepth:'50'}))await phone.page.fill('#'+field,value);
 await touch(phone,'#cabinetModalSave');await until(phone,()=>document.getElementById('cabinetModal').style.display==='none'&&!window.FC.applicationStartup.inspect().transactionPending,'Offline cabinet from native form');
 await touch(phone,'#sessionSave');await until(phone,()=>!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending,'New project durable Save');
 const fresh=await proof(phone),newProject=JSON.parse(fresh.image.rows.fc_projects_v1).find(p=>!first.projects.some(s=>s.replica?.key===p.id));assert.ok(newProject);assert.equal(fresh.app.cloudConfirmed,false);assert.equal((await getDoc(doc(server,'users',uid,'localFirstProjects',newProject.id))).exists(),false);
 await phone.page.context().setOffline(false);await phone.page.evaluate(()=>window.FC.applicationStartup.refresh());await until(phone,ready,'New project initial publication');await computer.page.waitForFunction(id=>!!window.FC.projectStore.getById(id),newProject.id);assert.equal((await getDoc(doc(server,'users',uid,'localFirstProjects',newProject.id))).exists(),true);
 t.diagnostic('PASS a new investor/project created offline remains durable locally and is admitted to the existing queue only after server authorization');

 const head=(await getDoc(doc(server,'users',uid,'globalData','current'))).data();
 const conflict=await device('catalog-conflict');await conflict.page.evaluate(()=>{const fc=window.FC,c=fc.globalDataContract,v=c.capture(localStorage,Object.keys(c.schemas)).model;v.materials[0].price+=0.125;for(const key of c.sources.materials)localStorage.setItem(key,JSON.stringify(v.materials));});
 await enable(conflict);await until(conflict,()=>window.FC.applicationStartup.inspect().backgroundSync?.code==='LF_INITIAL_GLOBAL_CONFLICT','Catalog conflict refusal');
 assert.deepEqual((await getDoc(doc(server,'users',uid,'globalData','current'))).data(),head);assert.equal((await proof(conflict)).globals.replica,null);
 const conflictProject=await device('project-conflict');await conflictProject.page.evaluate(({rows,pid,iid})=>{for(const key of ['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1'])localStorage.setItem(key,rows[key]);const projects=JSON.parse(localStorage.getItem('fc_projects_v1'));projects.find(p=>p.id===pid).title+=' synthetic conflict';localStorage.setItem('fc_projects_v1',JSON.stringify(projects));window.FC.projectStore.setCurrentProjectId(pid);window.FC.investors.setCurrentId(iid);},{rows:final.image.rows,pid,iid});
 await enable(conflictProject);await until(conflictProject,()=>window.FC.applicationStartup.inspect().backgroundSync?.code==='LF_INITIAL_PROJECT_CONFLICT','Project conflict refusal');
 assert.deepEqual((await getDoc(doc(server,'users',uid,'localFirstProjects',pid))).data(),serverBeforeRestart);
 t.diagnostic('PASS differing catalog and project preserve both sources; no inferred merge, price change or overwrite');
 const beforeDenial=await proof(computer);await env.withSecurityRulesDisabled(async ctx=>deleteDoc(doc(ctx.firestore(),'appAccess',uid)));
 await computer.page.evaluate(()=>window.FC.applicationStartup.refresh().catch(()=>{}));await until(computer,()=>window.__FC_MAIN_ACCESS__.isValid()===false,'Real server denial');
 const denied=await proof(computer);assert.deepEqual(denied.image.rows,beforeDenial.image.rows);assert.deepEqual(denied.source,beforeDenial.source);assert.deepEqual(denied.projects,beforeDenial.projects);
 t.diagnostic('PASS real Rules/admission denial stops access while preserving existing image, queue and source');
}
