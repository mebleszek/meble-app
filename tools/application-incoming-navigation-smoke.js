'use strict';
// A first verified project may select its owner, but receiving data must never
// replace the user's current view. Synthetic data; production projector only.
const assert=require('node:assert/strict');
async function main(){
 const {projectApplicationRows}=await import('../sync/application-replication.mjs');
 const owner={project:{id:'project-one',investorId:'investor-one',title:'Test project'},
  investor:{id:'investor-one',name:'Test investor'},
  offers:[{id:'offer-one',project:{id:'project-one'},investor:{id:'investor-one'}}]};
 const remote={value:{document:{payload:owner}}};
 const contract={validate(payload){assert.equal(payload,owner,'Production projector must validate the received payload');}};
 const source=view=>({
  fc_projects_v1:'[]',fc_investors_v1:'[]',fc_quote_snapshots_v1:'[]',
  fc_current_project_id_v1:null,fc_current_investor_v1:null,
  fc_ui_v1:JSON.stringify(view),fc_edit_session_v1:null,
  fc_investor_removed_ids_v1:'[]',fc_quote_rates_v1:'PRESERVE_GLOBAL_RAW'
 });
 let assertions=0;
 for(const view of [
  {entry:'home',activeTab:'pokoje'},
  {entry:'modeHub',workMode:'furnitureProjects',activeTab:null},
  {entry:'investorsList',workMode:'furnitureProjects',activeTab:null}
 ]){
  const rows=source(view),before=structuredClone(rows);
  const next=projectApplicationRows(rows,{scope:owner.project.id},remote,{},contract);
  assert.deepEqual(rows,before,'Incoming projection cannot mutate the source');
  assert.equal(next.fc_ui_v1,rows.fc_ui_v1,'Incoming records cannot navigate away from '+view.entry);
  assert.equal(next.fc_current_project_id_v1,owner.project.id,'First project remains selected');
  assert.equal(next.fc_current_investor_v1,owner.investor.id,'First investor remains selected');
  assert.deepEqual(JSON.parse(next.fc_projects_v1),[owner.project]);
  assert.deepEqual(JSON.parse(next.fc_investors_v1),[owner.investor]);
  assert.deepEqual(JSON.parse(next.fc_quote_snapshots_v1),owner.offers);
  assert.equal(next.fc_quote_rates_v1,rows.fc_quote_rates_v1,'Global prices remain unchanged');
  assert.equal(next.fc_edit_session_v1,rows.fc_edit_session_v1,'Draft state remains untouched');
  assertions++;
 }
 const existing={project:{id:'old-project',investorId:'old-investor',title:'Unrelated'},
  investor:{id:'old-investor',name:'Preserved'},
  offer:{id:'old-offer',project:{id:'old-project'},investor:{id:'old-investor'}}};
 const rows=source({entry:'modeHub',workMode:'furnitureProjects',activeTab:null});
 rows.fc_projects_v1=JSON.stringify([existing.project]);
 rows.fc_investors_v1=JSON.stringify([existing.investor]);
 rows.fc_quote_snapshots_v1=JSON.stringify([existing.offer]);
 rows.fc_current_project_id_v1=existing.project.id;
 rows.fc_current_investor_v1=existing.investor.id;
 const next=projectApplicationRows(rows,{scope:owner.project.id},remote,{},contract);
 assert.equal(next.fc_ui_v1,rows.fc_ui_v1,"An existing user's view is never replaced");
 assert.equal(next.fc_current_project_id_v1,existing.project.id,'Existing selection remains unchanged');
 assert.equal(next.fc_current_investor_v1,existing.investor.id);
 assert.deepEqual(JSON.parse(next.fc_projects_v1),[existing.project,owner.project]);
 assert.deepEqual(JSON.parse(next.fc_investors_v1),[existing.investor,owner.investor]);
 assert.deepEqual(JSON.parse(next.fc_quote_snapshots_v1),[existing.offer,...owner.offers]);
 assertions++;
 const conflicting=source({entry:'home'});
 conflicting.fc_projects_v1=JSON.stringify([{id:owner.project.id,investorId:'someone-else'}]);
 assert.throws(()=>projectApplicationRows(conflicting,{scope:owner.project.id},remote,{},contract),
  error=>error.code==='LF_PROJECT_OWNER_CHANGED','Owner mismatch must still refuse');
 assertions++;
 console.log('PASS incoming navigation projection: '+assertions+' scenarios, view/pointers/RAW/history and owner conflict');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
