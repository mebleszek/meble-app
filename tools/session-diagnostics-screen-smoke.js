'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./project-navigation-blockers-smoke');
const P='fc_projects_v1',E='fc_edit_session_v1';
(async()=>{
 let passed=0;
 for(const action of ['save','cancel','navigation']){
  const old=fixture(undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});await old.open();
  old.storage.fail.set(E,true);old.s.projectData.room_k.cabinets[0].width=65;
  assert.equal(old.FC.project.saveConfirmed(old.s.projectData).projectSaved,true);
  const r=fixture(old.seed(),{timers:{setTimeout:()=>0,clearTimeout:()=>{}}}),before=r.seed();
  r.FC.confirmBox={ask:async()=>true};
  if(action==='navigation')assert.equal(await r.FC.tabNavigation.setActiveTab('wycena'),false);
  else await r.handlers['session-'+action]({});
  assert.ok(r.messages.some(x=>x.sessionDiagnostic===true),'Real refusal exposes diagnostic action: '+action);
  assert.deepEqual(r.seed(),before);assert.equal(r.FC.session.active,true);passed++;
 }
 const r=fixture(undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});r.storage.fail.set(E,true);
 assert.equal(await r.open(),false);assert.ok(r.messages.some(x=>x.title==='Nie udało się zabezpieczyć sesji edycji'&&x.sessionDiagnostic===true));passed++;
 const collector=require('./diagnostics/pixel-session-readonly');assert.equal(collector,require('../js/app/ui/session-diagnostics-readonly'));passed++;
 for(const page of ['index.html','dev_tests.html']){
  const html=fs.readFileSync(page,'utf8');
  const scripts=['info-box.js','session-diagnostics-readonly.js','session-diagnostics.js'];let previous=-1;
  for(const script of scripts){const needle='js/app/ui/'+script+'?v='+(script==='info-box.js'?'20261020_session_diagnostics':require('./script-versions').versions['js/app/ui/'+script]);const i=html.indexOf(needle);assert.ok(i>previous,page+' '+script);assert.equal(html.indexOf(needle,i+1),-1);previous=i;}
 }
 passed++;console.log(`Session diagnostic screen: ${passed}/${passed} PASS`);
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
