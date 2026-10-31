'use strict';
const assert=require('node:assert/strict');
async function exerciseListDeletion({evaluate,tap,until,settle,send,login}){
 const ids=await evaluate('window.FC.investors.readAll().map(inv=>inv.id)');assert.equal(ids.length,3);
 const kept=await evaluate('projectData.meta.assignedInvestorId'),targets=ids.filter(id=>id!==kept);assert.equal(targets.length,2);
 const protectedKeys=['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1','fc_quote_rates_v1','fc_project_backup_v1','fc_data_backups_v1'];
 const snapshot=()=>evaluate('JSON.stringify('+JSON.stringify(protectedKeys)+'.map(key=>[key,localStorage.getItem(key)]))');
 const raw=await snapshot(),ram=await evaluate('JSON.stringify(projectData)'),logouts=await evaluate('window.__testLogoutCalls||0');
 const bounds=await evaluate(`(()=>{const add=document.querySelector('[data-action="create-investor"]').getBoundingClientRect(),remove=document.querySelector('[data-action="remove-investor-from-list"]').getBoundingClientRect();return {adjacent:Math.abs(add.top-remove.top)<1&&remove.left>=add.right,color:getComputedStyle(document.querySelector('[data-action="remove-investor-from-list"]')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
 assert.equal(bounds.adjacent,true);assert.equal(bounds.overflow,false);assert.match(bounds.color,/239, 68, 68|220, 38, 38|248, 113, 113/);
 async function choose(id){
  const index=await evaluate('window.FC.investors.search(window.FC.investorUI.state.query).findIndex(inv=>inv.id==='+JSON.stringify(id)+')');assert.ok(index>=0);
  await tap('[data-action="remove-investor-from-list"]');await until('document.querySelector(".confirm-title")?.textContent==="USUŃ INWESTORA Z LISTY"','delete picker');
  await tap('.confirm-actions button:nth-child('+(index+1)+')');await until('document.querySelector(".confirm-title")?.textContent==="Usunąć inwestora z listy?"','explicit deletion confirmation');
 }
 await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector(".confirm-box")','delete picker Back');await tap('.confirm-box .is-neutral');
 await choose(targets[0]);await tap('.confirm-box .is-neutral');assert.equal(await snapshot(),raw);assert.equal(await evaluate('localStorage.getItem("fc_investor_removed_ids_v1")'),null);
 for(const id of targets){
  const name=await evaluate('window.FC.investors.getById('+JSON.stringify(id)+').name');
  await choose(id);assert.ok((await evaluate('document.querySelector(".confirm-message").textContent')).includes(name));
  await tap('.confirm-box .is-danger');await until('document.querySelector(".info-box__title")?.textContent==="Usunięto z listy"','confirmed list deletion');await tap('.info-box .is-success');
  assert.equal(await evaluate('!!document.querySelector(\'[data-action="open-investor"][data-inv-id="'+id+'"]\')'),false);
  assert.equal(await snapshot(),raw);assert.equal(await evaluate('JSON.stringify(projectData)'),ram);
 }
 assert.equal(await evaluate('window.__testLogoutCalls||0'),logouts);assert.equal(await evaluate('__FC_MAIN_ACCESS__.isValid()'),true);
 const viewport=await evaluate('({width:innerWidth,height:innerHeight})');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate('(()=>{const a=document.querySelector(".investor-list-toolbar__actions");return a.scrollWidth<=a.clientWidth&&document.documentElement.scrollWidth<=innerWidth;})()'),true);
 // The narrow-width assertion concerns the list toolbar. Restore the owning
 // fixture's viewport before its full-document restart/project navigation.
 await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
 await settle();await send('Page.reload',{ignoreCache:true});await until('document.body?.dataset.authState==="unauthenticated"','list deletion restart');await login();await until('document.body?.dataset.businessState==="ready"','list deletion restart ready');
 await evaluate('window.FC.views.openInvestorsList()');
 for(const id of targets)assert.equal(await evaluate('window.FC.investors.getById('+JSON.stringify(id)+')'),null);
 assert.equal(await snapshot(),raw);assert.ok(await evaluate('window.FC.investors.getById('+JSON.stringify(kept)+')'));
 await tap('[data-action="open-investor"][data-inv-id="'+kept+'"]');await until('uiState.currentInvestorId==='+JSON.stringify(kept)+'&&document.getElementById("investorView").style.display==="block"','unrelated investor still opens');
 await tap('#sessionCancel');await until('uiState.entry==="investorsList"','list deletion final Exit');
 console.log('PASS native mobile minus beside Add: picker/confirmation Back, two blocked historical deletions, 393/320px, unchanged projects/history/catalogs/RAM, restart and unrelated investor still opens');
}
module.exports={exerciseListDeletion};
