'use strict';
// Real node:test hook inheritance; synthetic lifecycle state, no SDK/emulators.
const assert = require('node:assert/strict');
const {test, beforeEach, afterEach} = require('node:test');
async function main(){
  const {topLevelFixture,selectProjectFixture} = await import('./firebase-pilot/cloud-sync-fixture.mjs');
  const events = []; let state, setup = 0, cleanup = 0;
  beforeEach(topLevelFixture(async context=>{
    events.push('setup:'+context.name); setup++;
    state = {grant:true, revision:0, editor:null, operation:null, raw:'SYNTHETIC-EXACT-RAW'};
  }));
  afterEach(topLevelFixture(async context=>{
    events.push('cleanup:'+context.name); cleanup++; state = null;
  }));
  await test('LOCAL-FIRST fixture: seven sequential children retain their state', async t=>{
    assert.equal(setup,1); assert.equal(cleanup,0);
    for(let i=1;i<=7;i++) await t.test('lifecycle '+i,async child=>{
      assert.equal(state.grant,true,'A nested hook must not delete the emulator grant');
      assert.equal(state.revision,i-1,'A nested hook must not delete prior confirmed heads');
      assert.equal(state.editor,i===1?null:'synthetic-editor');
      assert.equal(state.operation,i===1?null:'synthetic-operation');
      assert.equal(state.raw,'SYNTHETIC-EXACT-RAW');
      state.revision++;state.editor='synthetic-editor';state.operation='synthetic-operation';
      if(i===4) await child.test('deeper child retains fixture too',()=>assert.equal(state.revision,4));
      assert.equal(setup,1);assert.equal(cleanup,0);
    });
    assert.equal(state.revision,7);
  });
  assert.equal(setup,1);assert.equal(cleanup,1);assert.equal(state,null);
  await test('Independent top-level case still receives a clean isolated fixture',()=>{
    assert.equal(setup,2);assert.equal(cleanup,1);
    assert.deepEqual(state,{grant:true,revision:0,editor:null,operation:null,raw:'SYNTHETIC-EXACT-RAW'});
  });
  assert.equal(setup,2);assert.equal(cleanup,2);assert.equal(state,null);
  assert.deepEqual(events,[
    'setup:LOCAL-FIRST fixture: seven sequential children retain their state',
    'cleanup:LOCAL-FIRST fixture: seven sequential children retain their state',
    'setup:Independent top-level case still receives a clean isolated fixture',
    'cleanup:Independent top-level case still receives a clean isolated fixture'
  ]);
  let touched=false;
  await assert.rejects(topLevelFixture(()=>{touched=true;})({name:'missing-full-name'}),/TEST_CONTEXT_REQUIRED/);
  assert.equal(touched,false,'Unknown test scope must refuse destructive setup');
  // Ensure the actual SDK suite uses the tested boundary for BOTH hook types.
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'firebase-pilot/cloud-sync-global.test.mjs'),'utf8');
  assert.match(source,/beforeEach\(topLevelFixture\(async \(\) => env\.clearFirestore\(\)\)\);/);
  assert.match(source,/afterEach\(topLevelFixture\(async \(\) => \{/);
  assert.equal((source.match(/beforeEach\(/g)||[]).length,1);
  assert.equal((source.match(/afterEach\(/g)||[]).length,1);
  const {fixture}=require('./project-selective-export-smoke.js'),native=fixture();
  const build=()=>native.FC.projectSelectiveExport.build({projectId:'B',investorId:'inv-B',purpose:'pilot'});
  assert.equal((await build()).code,'EXPORT_CONTEXT_MISMATCH','The native validator must reject an incoherent fixture');
  const recordsBefore=native.rows();selectProjectFixture(native,'B');
  const selected=native.rows();
  for(const key of Object.keys(recordsBefore)){
    if(['fc_current_investor_v1','fc_current_project_id_v1'].includes(key))continue;
    assert.equal(selected[key],recordsBefore[key],'Fixture selection cannot modify business RAW');
  }
  assert.deepEqual(Object.keys(selected).sort(),Object.keys(recordsBefore).sort());
  assert.equal(native.FC.projectStore.getCurrentProjectId(),'B');
  assert.equal(native.FC.investors.getCurrentId(),'inv-B');
  assert.equal(native.s.uiState.currentInvestorId,'inv-B');
  const sourceBefore=native.rows(),ramBefore=JSON.stringify(native.s.projectData),document=await build();
  assert.equal(document.ok,true,JSON.stringify(document));
  assert.equal(document.document.payload.project.id,'B');
  assert.equal(document.document.payload.investor.id,'inv-B');
  assert.deepEqual(native.rows(),sourceBefore);assert.equal(JSON.stringify(native.s.projectData),ramBefore);
  assert.throws(()=>selectProjectFixture(native,'not-present'),/TEST_PROJECT_CONTEXT_REQUIRED/);
  assert.deepEqual(native.rows(),sourceBefore);
  const sdkSource=fs.readFileSync(path.join(__dirname,'firebase-pilot/local-first.test.mjs'),'utf8');
  assert.match(sdkSource,/const pf=selectProjectFixture\(fixture\(\),projectId\);/);
  console.log('PASS LOCAL-FIRST hook lifecycle: seven children + deeper child preserved; top-level reset/cleanup retained; unknown scope refused');
  console.log('PASS LOCAL-FIRST native project-B fixture: strict context validation retained, RAW/RAM unchanged by export');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
