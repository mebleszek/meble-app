'use strict';
const assert=require('node:assert/strict');
async function exerciseFullDeletion(device){
 const evaluate=x=>device.evaluate(x),until=x=>device.until(x),touch=x=>device.touch(x);
 await device.send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 await evaluate(`(()=>{const fc=window.FC;if(!fc.investors.readAll().length){const inv=fc.investors.create({kind:'person',name:'Synthetic retained owner',rooms:[]});if(!inv||!fc.projectStore.ensureForInvestor(inv.id))throw Error('Retained fixture refused');projectData=fc.project.load();window.projectData=projectData;}fc.views.openInvestorsList();})()`);
 const ids=await evaluate(`(()=>{
 const fc=window.FC,all=fc.investors.readAll(),owner=all[0],project=fc.projectStore.getByInvestorId(owner.id);
 if(fc.session.active||uiState.entry!=='investorsList'||!project)throw Error('Deletion fixture requires idle native list');
 const ids=['synthetic_delete_one','synthetic_delete_two'];
 fc.investors.writeAll([...all,...ids.map((id,i)=>({...structuredClone(owner),id,name:'Synthetic deletion '+(i+1),rooms:structuredClone(owner.rooms)}))]);
 for(const [n,id] of ids.entries()){const row=structuredClone(project);row.id='synthetic_project_'+n;row.investorId=id;row.projectData.meta.assignedInvestorId=n===0?owner.id:id;if(!fc.projectStore.upsert(row))throw Error('Synthetic project seed denied');}
 const saved=[{version:7,id:'delete_offer_one',investor:{id:ids[0]},project:{id:'synthetic_project_0'}},{version:7,id:'delete_offer_two',investor:{id:ids[1]},project:{id:'synthetic_project_1'}}];
 localStorage.setItem('fc_quote_snapshots_v1',JSON.stringify(saved));
 localStorage.setItem('fc_quote_offer_drafts_v1',JSON.stringify(ids.map((id,n)=>({projectId:'synthetic_project_'+n,investorId:id}))));
 fc.investorUI.renderListOnly(document.getElementById('investorsListRoot'));return ids;
 })()`);
 const keep=await evaluate('JSON.stringify(window.FC.projectStore.readAll().filter(p=>!p.id.startsWith("synthetic_project_")))');
 const originalRam=await evaluate('JSON.stringify(projectData)'),trust=await evaluate('localStorage.getItem("meble_device_trust_fence_v1")');
 await touch('[data-action="open-investor"][data-inv-id="'+ids[0]+'"]');await until('document.querySelector(".info-box")?.textContent.includes("PROJECT_OWNER_CONFLICT")');await touch('.info-box .is-success');
 await touch('[data-action="remove-investor-from-list"]');
 for(const id of ids)await touch('[data-investor-delete-id="'+id+'"]');
 await touch('[data-action="remove-investor-from-list"]');await until('!!document.querySelector(".confirm-box")');
 const preview=await evaluate('document.querySelector(".confirm-message").textContent');
 for(const text of ['Inwestorzy: 2','Projekty: 2','Zapisane oferty / wyceny: 2','Robocze oferty: 2'])assert.ok(preview.includes(text),preview);
 await touch('.confirm-box .is-danger');
 try{await until('document.querySelector(".info-box__title")?.textContent==="Usunięto inwestorów"');}
 catch(e){throw Error(e.message+' '+await evaluate('JSON.stringify({message:document.querySelector(".info-box")?.textContent,clients:window.FC.investorDeletion.clientStatus()})'));}
 await touch('.info-box .is-success');
 assert.equal(await evaluate('!!document.querySelector("[data-investor-delete-id]")'),false);
 for(const id of ids)assert.equal(await evaluate('window.FC.investors.getById('+JSON.stringify(id)+')'),null);
 assert.equal(await evaluate('JSON.stringify(window.FC.projectStore.readAll().filter(p=>!p.id.startsWith("synthetic_project_")))'),keep);
 assert.deepEqual(await evaluate('JSON.parse(localStorage.getItem("fc_quote_snapshots_v1"))'),[]);
 assert.deepEqual(await evaluate('JSON.parse(localStorage.getItem("fc_quote_offer_drafts_v1"))'),[]);
 assert.equal(await evaluate('JSON.stringify(projectData)'),originalRam);assert.equal(await evaluate('localStorage.getItem("meble_device_trust_fence_v1")'),trust);
 assert.equal(await evaluate('__FC_MAIN_ACCESS__.isValid()'),true);assert.equal(await evaluate('window.FC.investorDeletion.pending()'),false);
 // Same real, closed-origin offline shell reloads; recovery cannot recreate IDs.
 await device.reload();await until('document.body.dataset.businessState==="ready"');
 for(const id of ids)assert.equal(await evaluate('window.FC.investors.getById('+JSON.stringify(id)+')'),null);
 assert.equal(await evaluate('JSON.stringify(window.FC.projectStore.readAll())'),keep);
 // Inject a real post-consent pre-mutation failure in this synthetic profile.
 // Then discard only the local hint as a simulated lost flush; strict IDB
 // intent must recover at the loader barrier without a second confirmation.
 await evaluate(`(()=>{const fc=window.FC,owner=fc.investors.readAll()[0],project=fc.projectStore.getByInvestorId(owner.id),id='synthetic_delete_recovery';
 fc.views.openInvestorsList();fc.investors.writeAll([...fc.investors.readAll(),{...structuredClone(owner),id,name:'Synthetic recovery'}]);
 const row=structuredClone(project);row.id='synthetic_project_recovery';row.investorId=id;row.projectData.meta.assignedInvestorId=id;if(!fc.projectStore.upsert(row))throw Error('Recovery seed refused');fc.investorUI.renderListOnly(document.getElementById('investorsListRoot'));})()`);
 await touch('[data-action="remove-investor-from-list"]');await touch('[data-investor-delete-id="synthetic_delete_recovery"]');await touch('[data-action="remove-investor-from-list"]');
 await until('!!document.querySelector(".confirm-box")');
 await evaluate('window.FC.offlineShell.prepare=async()=>{throw Error("SYNTHETIC_WORKER_UNAVAILABLE");}');
 await touch('.confirm-box .is-danger');await until('document.querySelector(".info-box__title")?.textContent==="Usuwanie wstrzymane"');
 assert.equal(await evaluate('window.FC.investorDeletion.pending()'),true);
 assert.equal(await evaluate(`new Promise((resolve,reject)=>{const q=indexedDB.open('meble-investor-delete-v1',1);q.onerror=reject;q.onsuccess=()=>{const db=q.result,tx=db.transaction('operations'),r=tx.objectStore('operations').getAll();tx.oncomplete=()=>{db.close();resolve(r.result.filter(row=>row.state==='pending').length);};};})`),1);
 await evaluate('localStorage.removeItem("meble_investor_delete_journal_v1")');
 await device.reload();await until('document.body.dataset.businessState==="ready"');
 assert.equal(await evaluate('window.FC.investors.getById("synthetic_delete_recovery")'),null);
 assert.equal(await evaluate('window.FC.investorDeletion.pending()'),false);
 assert.equal(await evaluate('JSON.stringify(window.FC.projectStore.readAll())'),keep);
 assert.equal(await evaluate('__FC_MAIN_ACCESS__.isValid()'),true);
 console.log('PASS native strict-IDB pending intent survives missing local hint and offline document restart; recovery before project initialization, no reconsent, retained foreign data/trust');
 console.log('PASS real Chromium/SW client census, offline multi-delete of conflict-owned project, frozen/draft cleanup, preserved other records/trust/RAM and offline document restart');
}
module.exports={exerciseFullDeletion};
