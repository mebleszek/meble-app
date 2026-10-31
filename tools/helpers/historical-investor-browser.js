'use strict';
// Disposable mobile Chromium profile owned by empty-installation-browser-smoke.
// Historical RAW is seeded only in this synthetic fixture, never owner storage.
const assert=require('node:assert/strict');
async function exerciseHistoricalInvestors({evaluate,tap,until,settle,send,login,fill}){
  await evaluate(`(()=>{
    const fc=window.FC;if(fc.session.active||uiState.entry!=='investorsList')throw Error('Historical fixture requires closed context');
    const rows=JSON.parse(localStorage.getItem('fc_projects_v1'));
    const old=rows.find(row=>row.id!==fc.projectStore.getCurrentProjectId());
    window.__historicalOwner=old.investorId;
    old.projectData.kuchnia.cabinets=[{id:'synthetic-historical-cabinet',type:'stojąca',subType:'drzwi',width:63.5,height:72,depth:52,setId:'synthetic-historical-set',futureField:{exact:7.125}}];
    old.projectData.kuchnia.sets=[{id:'synthetic-historical-set',futureField:'KEEP'}];
    localStorage.setItem('fc_projects_v1',JSON.stringify(rows));
    window.__historicalRows=rows;window.__historicalRaw=localStorage.getItem('fc_projects_v1');
    window.__historicalActivations=0;const activate=fc.investorProjectRuntime.setActiveProjectFromInvestor;
    fc.investorProjectRuntime.setActiveProjectFromInvestor=function(...args){window.__historicalActivations++;return activate(...args);};
  })()`);
  const ids=await evaluate('window.__historicalRows.map(row=>row.investorId)'),raw=await evaluate('window.__historicalRaw');
  // Open the historical investor first, from another investor's retained RAM.
  const historical=await evaluate('window.__historicalOwner');
  await tap('[data-action="open-investor"][data-inv-id="'+historical+'"]');
  try{await until('document.getElementById("investorView").style.display==="block"&&uiState.currentInvestorId==='+JSON.stringify(historical),'native historical investor Open');}
  catch(error){throw Error(error.message+' '+JSON.stringify(await evaluate('({activations:window.__historicalActivations,divergent:window.FC.investorProjectRuntime.hasProjectDivergence(projectData),defaultFields:projectData.kuchnia.cabinets.map(c=>({frontCount:c.frontCount,details:c.details})),notice:document.querySelector(".info-box")?.textContent})')));}
  assert.equal(await evaluate('window.__historicalActivations'),1,'One gesture must activate the investor exactly once');
  assert.equal(await evaluate('window.FC.investorProjectRuntime.hasProjectDivergence(projectData)'),false,'Read defaults are not an unsaved edit');
  assert.equal(await evaluate('localStorage.getItem("fc_projects_v1")===window.__historicalRaw'),true,'Opening historical data must not approve a migration or save RAM');
  assert.deepEqual(await evaluate('({fronts:projectData.kuchnia.cabinets[0].frontCount,details:projectData.kuchnia.cabinets[0].details,setNumber:projectData.kuchnia.cabinets[0].setNumber,number:projectData.kuchnia.sets[0].number})'),{fronts:2,details:{},setNumber:1,number:1});
  await tap('#sessionCancel');await until('uiState.entry==="investorsList"','historical Exit');
  for(const phase of ['exit-reopen','logout-reauth','document-restart']){
    if(phase==='logout-reauth'){
      await tap('#main-signout');await until('!__FC_MAIN_ACCESS__.isValid()','historical logout');
      await login();await until('__FC_MAIN_ACCESS__.isValid()','historical reauthentication');
    }
    if(phase==='document-restart'){
      await settle();await send('Page.reload',{ignoreCache:true});await until('document.body?.dataset.authState==="unauthenticated"','historical restart requires login');
      await login();await until('document.body?.dataset.businessState==="ready"','historical restart business ready');
    }
    if(await evaluate('uiState.entry!=="investorsList"')){
      await tap('#openFurnitureProjectsBtn');await until('uiState.entry==="modeHub"','restart furniture hub');
      await tap('#modeHubRoot [data-action="open-investors-list"]');await until('uiState.entry==="investorsList"','restart investor list');
    }
    for(const id of ids){
      await tap('[data-action="open-investor"][data-inv-id="'+id+'"]');
      await until('document.getElementById("investorView").style.display==="block"&&uiState.currentInvestorId==='+JSON.stringify(id)+'&&projectData.meta.assignedInvestorId==='+JSON.stringify(id),phase+' native Open');
      assert.equal(await evaluate('window.FC.projectStore.getCurrentRecord().investorId'),id);
      assert.equal(await evaluate('window.FC.investorProjectRuntime.hasProjectDivergence(projectData)'),false);
      assert.equal(await evaluate('window.FC.session.active'),false);
      const expected=JSON.parse(raw).find(row=>row.investorId===id);
      assert.deepEqual(await evaluate('projectData'),await evaluate('window.FC.projectBootstrap.normalizeProjectData(window.FC.project.normalize('+JSON.stringify(expected.projectData)+'),window.FC.project.DEFAULT_PROJECT)'),phase+' RAM must contain exactly this investor project, including saved rooms and unknown fields');
      const actual=await evaluate('localStorage.getItem("fc_projects_v1")');
      const paths=(a,b,p='')=>JSON.stringify(a)===JSON.stringify(b)?[]:!a||!b||typeof a!=='object'||typeof b!=='object'?[p]:[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>paths(a[k],b[k],p+'.'+k));
      assert.equal(actual===raw,true,phase+' must preserve all original historical/project bytes; differences: '+JSON.stringify(paths(JSON.parse(actual),JSON.parse(raw))));
      await tap('#sessionCancel');await until('uiState.entry==="investorsList"',phase+' Exit');
    }
  }
  console.log('PASS native historical/new investor Open, one activation, unchanged RAW, Exit/reopen, logout/reauth and document restart');
  await exerciseLegacyMetadataOwners({evaluate,tap,until,settle,send,login,fill});
}
async function exerciseLegacyMetadataOwners({evaluate,tap,until,settle,send,login,fill}){
  const oldIds=await evaluate('window.FC.investors.readAll().map(inv=>inv.id)');assert.equal(oldIds.length,2);
  // Create a real third investor through the existing form/confirmation. Then
  // seed the exact pre-metadata shape only in this disposable test profile.
  await tap('[data-action="create-investor"]');await until('!!document.getElementById("invName")','third investor form');
  for(const [id,value]of Object.entries({invName:'Synthetic Third Owner',invPhone:'111222333',invCity:'Third City',invEmail:'third@example.invalid',invAddress:'Synthetic address 3',invNotes:'Three-owner regression'}))await fill('#'+id,value);
  await evaluate(`(()=>{const el=document.getElementById('invSource');el.value=[...el.options].find(o=>o.value)?.value;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await tap('#investorActionBar [data-investor-action="save"]');await until('!!document.querySelector(".confirm-box")','third investor confirmation');await tap('.confirm-box .is-success');
  await until('window.FC.investors.readAll().length===3','third investor stored');const third=await evaluate('window.FC.investors.getCurrentId()');
  await tap('#sessionCancel');await until('uiState.entry==="investorsList"','third investor Exit');
  await evaluate(`(()=>{const rows=JSON.parse(localStorage.getItem('fc_projects_v1')),ids=${JSON.stringify(oldIds)};for(const row of rows)if(ids.includes(row.investorId))delete row.projectData.meta.assignedInvestorId;delete rows.find(row=>row.investorId===ids[0]).projectData.meta.productionPcvMode;localStorage.setItem('fc_projects_v1',JSON.stringify(rows));})()`);
  const raw=await evaluate('localStorage.getItem("fc_projects_v1")'),ids=[...oldIds,third];
  for(const phase of ['legacy-first-open','legacy-logout','legacy-restart']){
    if(phase==='legacy-logout'){await tap('#main-signout');await until('!__FC_MAIN_ACCESS__.isValid()','legacy logout');await login();await until('__FC_MAIN_ACCESS__.isValid()','legacy login');}
    if(phase==='legacy-restart'){
      await settle();await send('Page.reload',{ignoreCache:true});await until('document.body?.dataset.authState==="unauthenticated"','legacy cold document login');await login();await until('document.body?.dataset.businessState==="ready"','legacy document ready');
      if(await evaluate('uiState.entry!=="investorsList"')){await tap('#openFurnitureProjectsBtn');await until('uiState.entry==="modeHub"','legacy hub');await tap('#modeHubRoot [data-action="open-investors-list"]');await until('uiState.entry==="investorsList"','legacy list');}
    }
    for(const id of ids){
      await tap('[data-action="open-investor"][data-inv-id="'+id+'"]');
      await until('document.getElementById("investorView").style.display==="block"&&uiState.currentInvestorId==='+JSON.stringify(id),'legacy owner Open '+phase);
      assert.equal(await evaluate('projectData.meta.assignedInvestorId'),id);
      const record=JSON.parse(raw).find(row=>row.investorId===id);
      assert.deepEqual(await evaluate('projectData'),await evaluate('window.FC.projectBootstrap.normalizeProjectData(window.FC.projectPcvPolicy.ownerView(window.FC.project.normalize('+JSON.stringify(record.projectData)+'),'+JSON.stringify(record)+'),window.FC.project.DEFAULT_PROJECT)'),phase+' complete owner RAM, including unknown fields');
      assert.equal(await evaluate('localStorage.getItem("fc_projects_v1")'),raw,phase+' must never write legacy owner metadata/PCV during Open');
      assert.equal(await evaluate('window.FC.investorOpenDiagnostics.state.outcome'),'approved');
      await tap('#sessionCancel');await until('uiState.entry==="investorsList"','legacy Exit');
    }
  }
  // A conflicting explicit owner is refused; a five-project ambiguous inventory
  // is also refused, never "fixed" by selecting an arbitrary old record.
  await evaluate(`(()=>{const rows=JSON.parse(localStorage.getItem('fc_projects_v1'));rows.find(row=>row.investorId===${JSON.stringify(oldIds[0])}).projectData.meta.assignedInvestorId='synthetic-foreign-owner';localStorage.setItem('fc_projects_v1',JSON.stringify(rows));})()`);
  async function refusal(id,code,candidates){
    const before=await evaluate('JSON.stringify({raw:localStorage.getItem("fc_projects_v1"),session:localStorage.getItem("fc_edit_session_v1"),ram:projectData})');
    await tap('[data-action="open-investor"][data-inv-id="'+id+'"]');
    await until('!!document.querySelector(".info-box")&&document.querySelector(".info-box").textContent.includes('+JSON.stringify(code)+')','visible actual refusal '+code);
    await tap('.info-box__actions button:first-child');await until('document.querySelector(".info-box__title")?.textContent==="Diagnostyka sesji"','existing diagnostic action');
    const report=await evaluate('window.FC.sessionDiagnosticsReadonly(window,{storageUsage:true})');
    assert.equal(report.status,'READ_ONLY');assert.equal(report.code,code);assert.equal(report.investorOpen.candidateProjects,candidates);
    assert.equal(report.runningCode.handler,'20261031_historical_owner_v1');assert.equal(report.runningCode.activation,'20261031_historical_owner_v1');
    assert.equal(await evaluate('document.querySelector(".info-box").textContent.includes("20261031_historical_owner_v1")'),true);
    assert.equal(await evaluate('JSON.stringify({raw:localStorage.getItem("fc_projects_v1"),session:localStorage.getItem("fc_edit_session_v1"),ram:projectData})'),before,'Refusal/diagnostics must preserve exact RAM, RAW and session');
    await tap('.info-box .is-success');await until('!document.querySelector(".info-box")','close readonly report');
  }
  await refusal(oldIds[0],'PROJECT_OWNER_CONFLICT',1);
  await evaluate(`(()=>{const rows=JSON.parse(localStorage.getItem('fc_projects_v1'));for(const id of ${JSON.stringify(oldIds)}){const row=structuredClone(rows.find(row=>row.investorId===id));row.id+='-ambiguous';rows.push(row);}localStorage.setItem('fc_projects_v1',JSON.stringify(rows));})()`);
  assert.equal(await evaluate('window.FC.projectStore.readAll().length'),5);
  for(const id of oldIds)await refusal(id,'PROJECT_OWNER_UNCONFIRMED',2);
  await tap('[data-action="open-investor"][data-inv-id="'+third+'"]');await until('uiState.currentInvestorId==='+JSON.stringify(third)+'&&document.getElementById("investorView").style.display==="block"','third remains valid with five records');
  await tap('#sessionCancel');await until('uiState.entry==="investorsList"','third final Exit');
  console.log('PASS native two pre-owner-metadata investors + new third: readonly Open, logout/restart, explicit owner conflict, visible refusals with anonymous running-version diagnostics and five-project ambiguity');
}
module.exports={exerciseHistoricalInvestors};
