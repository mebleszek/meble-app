'use strict';
// Disposable mobile Chromium profile owned by empty-installation-browser-smoke.
// Historical RAW is seeded only in this synthetic fixture, never owner storage.
const assert=require('node:assert/strict');
async function exerciseHistoricalInvestors({evaluate,tap,until,settle,send,login}){
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
      assert.deepEqual(await evaluate('projectData'),await evaluate('window.FC.project.normalize('+JSON.stringify(expected.projectData)+')'),phase+' RAM must contain exactly this investor project, including saved rooms and unknown fields');
      const actual=await evaluate('localStorage.getItem("fc_projects_v1")');
      const paths=(a,b,p='')=>JSON.stringify(a)===JSON.stringify(b)?[]:!a||!b||typeof a!=='object'||typeof b!=='object'?[p]:[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>paths(a[k],b[k],p+'.'+k));
      assert.equal(actual===raw,true,phase+' must preserve all original historical/project bytes; differences: '+JSON.stringify(paths(JSON.parse(actual),JSON.parse(raw))));
      await tap('#sessionCancel');await until('uiState.entry==="investorsList"',phase+' Exit');
    }
  }
  console.log('PASS native historical/new investor Open, one activation, unchanged RAW, Exit/reopen, logout/reauth and document restart');
}
module.exports={exerciseHistoricalInvestors};
