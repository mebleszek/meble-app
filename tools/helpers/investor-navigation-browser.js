'use strict';
// Called only by mandatory trusted-session-browser-smoke, in its disposable
// profile with the HTTP origin stopped and the verified trusted shell offline.
const assert=require('node:assert/strict');
const {inspectTrustStorage}=require('./trusted-cold-start');
async function exerciseInvestorNavigation(device){
 const {evaluate,until,send}=device;
 const verifyClean=async stage=>{const state=await evaluate(`(()=>{const fc=window.FC,ram=projectData,row=fc.projectStore.getCurrentRecord(),snapshot=fc.session.snapshot&&JSON.parse(fc.session.snapshot.fc_projects_v1)[0],paths=(a,b,p='')=>{if(JSON.stringify(a)===JSON.stringify(b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return [p];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>paths(a[k],b[k],p+'.'+k));};return {alias:ram===window.projectData,central:paths(ram,row.projectData),snapshot:snapshot?paths(ram,snapshot.projectData):[],divergent:fc.investorProjectRuntime.hasProjectDivergence(ram)};})()`);assert.deepEqual(state,{alias:true,central:[],snapshot:[],divergent:false},stage+' '+JSON.stringify(state));};
 const before=await evaluate('('+inspectTrustStorage.toString()+')()');
 for(const width of [393,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:true});
  const bar=await evaluate(`(()=>{const bar=document.getElementById('main-auth-bar'),label=bar.querySelector('label'),out=document.getElementById('main-signout'),note=document.getElementById('main-trust-note'),status=document.getElementById('main-trust-status'),a=label.getBoundingClientRect(),b=out.getBoundingClientRect();return {label:label.textContent.trim(),logout:out.textContent.trim(),fits:bar.scrollWidth<=bar.clientWidth,sameRow:a.top<b.bottom&&b.top<a.bottom,accessible:document.getElementById('main-trust-phone').getAttribute('aria-describedby')===note.id&&note.textContent.includes('Każda osoba'),live:status.getAttribute('aria-live')==='polite',outside:!bar.contains(status)};})()`);
  assert.deepEqual(bar,{label:'Zaufany',logout:'Wyloguj',fits:true,sameRow:true,accessible:true,live:true,outside:true});
  assert.equal(await evaluate('document.getElementById("main-auth-bar").contains(document.getElementById("main-trust-note"))'),false);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 await evaluate(`(()=>{window.__navigationDocument=crypto.randomUUID();const fc=window.FC,inv=fc.investors.create({kind:'person',name:'Synthetic Navigation Owner',rooms:[]});if(!inv)throw Error('Synthetic investor setup refused');window.__navigationInvestor=inv.id;const ok=fc.actions.dispatch('open-investor',{element:{getAttribute:()=>inv.id}});return Promise.resolve(ok).then(value=>{if(value!==true)throw Error('Synthetic investor activation refused');});})()`);
 await until('document.getElementById("investorView").style.display==="block"&&uiState.currentInvestorId===window.__navigationInvestor&&window.FC.investors.getCurrentId()===window.__navigationInvestor');
 const token=await evaluate('window.__navigationDocument');
 await device.touch('.tab-btn[data-tab="wywiad"]');
 await until('uiState.activeTab==="inwestor"&&!document.getElementById("investor-room-hint").hidden');
 assert.equal(await evaluate('!!document.querySelector(".investor-add-room-btn.investor-room-cue")'),true);
 assert.equal(await evaluate('document.getElementById("roomsView").style.display'),'none');
 // Test-only fixture construction through the real central store. No company
 // profile or real data is used, and no active edit is bypassed.
 await evaluate(`(()=>{const fc=window.FC;if(fc.session.active)throw Error('Unexpected edit during fixture setup');const row=fc.projectStore.getCurrentRecord();row.projectData.room_mobile={cabinets:[],fronts:[],sets:[],settings:{roomHeight:260}};row.projectData.meta.roomDefs={room_mobile:{id:'room_mobile',baseType:'kuchnia',name:'Kuchnia',label:'Kuchnia',projectStatus:'nowy'}};row.projectData.meta.roomOrder=['room_mobile'];projectData=row.projectData;fc.layoutState.ensureLayout('room_mobile');row.projectData=projectData;if(!fc.projectStore.upsert(row))throw Error('Room fixture refused');projectData=fc.project.load();fc.investorUI.render();})()`);
 await verifyClean('fixture before session');
 await device.touch('.tab-btn[data-tab="material"]');await until('!!document.querySelector(".investor-room-quick-btn.investor-room-cue")');
 await device.touch('.investor-room-quick-btn[data-room="room_mobile"]');await until('uiState.roomType==="room_mobile"&&window.FC.session.active');
 await verifyClean('room opened / session begun');
 for(const tab of ['wywiad','material','rysunek','czynnosci']){
  await device.touch('.tab-btn[data-tab="'+tab+'"]');await until('uiState.activeTab==='+JSON.stringify(tab));
  await verifyClean('render '+tab);
  assert.equal(await evaluate('uiState.roomType'),'room_mobile');assert.equal(await evaluate('window.FC.session.roomId'),'room_mobile');
 }
 for(const tab of ['wywiad','material','rysunek','czynnosci','inwestor','wycena','rozrys','magazyn']){
  if(await evaluate('uiState.currentInvestorId!==window.__navigationInvestor')){
   await evaluate(`Promise.resolve(window.FC.actions.dispatch('open-investor',{element:{getAttribute:()=>window.__navigationInvestor}})).then(ok=>{if(ok!==true)throw Error('Reentry refused');})`);
   await until('uiState.currentInvestorId===window.__navigationInvestor&&window.FC.investors.getCurrentId()===window.__navigationInvestor');
   await device.touch('.investor-room-quick-btn[data-room="room_mobile"]');await until('window.FC.session.active');
  }
  await device.touch('.tab-btn[data-tab="'+tab+'"]');await until('uiState.activeTab==='+JSON.stringify(tab));
  await verifyClean('before Exit '+tab);
  await until('document.getElementById("sessionCancel").textContent==="Wyjdź"');
  const raw=await evaluate('localStorage.getItem("fc_projects_v1")');
  // One native touch only. No direct action dispatch or DOM click for Exit.
  await device.touch('#sessionCancel');await until('document.getElementById("investorsListView").style.display==="block"');
  assert.equal(await evaluate('window.__navigationDocument'),token,'Exit must not reload');
  assert.equal(await evaluate('window.FC.session.active'),false);assert.equal(await evaluate('localStorage.getItem("fc_edit_session_v1")'),null);
  assert.equal(await evaluate('localStorage.getItem("fc_projects_v1")'),raw);assert.equal(await evaluate('__FC_MAIN_ACCESS__.isValid()'),true);
  assert.equal(await evaluate('document.getElementById("main-trust-phone").checked'),true);
  assert.deepEqual(await evaluate('('+inspectTrustStorage.toString()+')()'),before);
 }
 assert.equal(await evaluate('__AUTH_INPUT_DIAGNOSTICS__().authCreations'),0,'Local trusted navigation must not initialize Auth offline');
 console.log('PASS native offline investor navigation: room redirects, chosen room retained, one touch Exit from eight tabs without reload/logout/data loss, trusted proof unchanged, accessible 393/320px topbar');
}
module.exports={exerciseInvestorNavigation};
