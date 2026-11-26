#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {createSandbox,loadSmokeFiles}=require('./app-dev-smoke');
const {rows}=require('./quote-performance-fixture');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const clone=x=>JSON.parse(JSON.stringify(x));
function runtime(){
 const s=createSandbox(),seed=rows(3,true);
 for(const [key,value]of Object.entries(seed))s.localStorage.setItem(key,value);
 loadSmokeFiles(s,require('./app-dev-smoke-lib/file-list').APP_DEV_SMOKE_FILES);const FC=s.FC;
 s.materials=JSON.parse(seed.fc_materials_v1);s.projectData=FC.project.load();
 s.uiState={...JSON.parse(seed.fc_ui_v1),activeTab:'wycena'};
 FC.quoteOfferStore.patchCurrentDraft({selection:{selectedRooms:['room_test_A'],materialScope:{kind:'all',includeFronts:true,includeCorpus:true}},commercial:{versionName:'Before'}});
 const state={},count={collect:0};const collect=FC.wycenaCore.collectQuoteData;
 FC.wycenaCore.collectQuoteData=async function(...args){count.collect++;return collect.apply(this,args);};
 const deps={getState:()=>state,setState:p=>Object.assign(state,p),render(){},
  getOfferDraft:()=>FC.quoteOfferStore.getCurrentDraft(),normalizeDraftSelection:d=>FC.wycenaCoreSelection.normalizeQuoteSelection(d.selection),
  ensureVersionNameBeforeGenerate:async()=>{FC.quoteOfferStore.patchCurrentDraft({commercial:{versionName:'After'}});return {cancelled:false};},
  getSnapshotId:q=>q.id,syncGeneratedQuoteStatus(){},getProjectStatusForHistory:()=>'',getSnapshotHistory:()=>FC.quoteSnapshotStore.listForProject('A')};
 return {s,FC,state,count,deps,run:()=>FC.wycenaTabShell.generateQuote({},deps,{source:'performance-regression'})};
}
const math=value=>JSON.stringify(value,(key,value)=>['generatedAt','generatedDate','diagnostics','performance','__projectPcvCandidate'].includes(key)?undefined:value);

test('Project record summary normalizes the real payload once and keeps detached data/counts',()=>{
 const r=runtime(),records=JSON.parse(r.s.localStorage.getItem('fc_projects_v1'));
 const normalize=r.FC.schema.normalizeProject;let calls=0;r.FC.schema.normalizeProject=function(...args){calls++;return normalize.apply(this,args);};
 for(const original of records){
  const record=clone(original);delete record.roomKeys;delete record.roomCount;delete record.cabinetCount;
  const before=JSON.stringify(record);calls=0;const result=r.FC.projectModel.normalizeProjectRecord(record);
  assert.equal(calls,1,'One canonical normalization per record; summary must not normalize it twice again');
  assert.equal(JSON.stringify(record),before,'Never mutate RAW input while summarizing');
  const expected=r.FC.projectModel.summarizeProjectData(record.projectData);
  assert.deepEqual(clone({roomKeys:result.roomKeys,roomCount:result.roomCount,cabinetCount:result.cabinetCount}),clone(expected));
  const firstRoom=result.roomKeys[0];if(firstRoom&&result.projectData[firstRoom].cabinets[0])result.projectData[firstRoom].cabinets[0].width=999;
  assert.equal(JSON.stringify(record),before,'Normalized output must remain detached');
 }
 r.FC.schema.normalizeProject=normalize;
});

test('Name-only change reuses real calculation and rebuilds final metadata',async()=>{
 const r=runtime();await r.run();assert.equal(r.state.lastQuote?.error,undefined,JSON.stringify(r.state));assert.equal(r.count.collect,1);
 const saved=r.FC.quoteSnapshotStore.listForProject('A');assert.equal(saved.length,1);assert.equal(saved[0].commercial.versionName,'After');
});
for(const [name,mutate]of [
 ['discount',r=>r.FC.quoteOfferStore.patchCurrentDraft({commercial:{discountPercent:12}})],
 ['catalog price',r=>{r.s.materials[0].price+=30;r.s.localStorage.setItem('fc_materials_v1',JSON.stringify(r.s.materials));}],
 ['optimizer controls',r=>{const input=r.s.document.createElement('input');input.id='rozK';input.value='8';r.s.document.body.appendChild(input);}],
 ['runtime board geometry',r=>{r.FC.materialCommon.FC_BOARD_THICKNESS_CM=2;}],
 ['commercial terms',r=>r.FC.quoteOfferStore.patchCurrentDraft({commercial:{customerNote:'Changed terms'}})]
])test(name+' changed during naming forces a fresh real calculation',async()=>{
 const r=runtime();r.deps.ensureVersionNameBeforeGenerate=async()=>{mutate(r);return {cancelled:false};};
 await r.run();assert.equal(r.count.collect,2);assert.equal(r.state.lastQuote?.error,undefined,JSON.stringify(r.state));assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,1);
});
test('Cancellation after actual calculation never saves a snapshot',async()=>{
 const r=runtime();r.deps.ensureVersionNameBeforeGenerate=async()=>({cancelled:true});await r.run();assert.equal(r.count.collect,1);assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
for(const [name,mutate]of [
 ['project revision',r=>{const rec=r.FC.projectStore.getById('A');rec.title+=' changed';r.FC.projectStore.upsert(rec);}],
 ['investor',r=>r.FC.investors.setCurrentId('inv-B')],
 ['unfinished session',r=>r.FC.session.begin('room_test_A')],
 ['expired server lease',r=>{r.s.__FC_MAIN_ACCESS__={assert(){throw Error('AUTH_ACCESS_REVOKED');}};}]
])test(name+' changed across naming await cannot save a reused result',async()=>{
 const r=runtime();r.deps.ensureVersionNameBeforeGenerate=async()=>{mutate(r);return {cancelled:false};};await r.run();
 assert.ok(r.state.lastQuote?.error);assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
test('Synchronous PCV sharing returns identical complete real calculation',async()=>{
 const r=runtime(),options={pcvMode:'project',projectId:'A',selection:r.deps.getOfferDraft().selection};
 const scoped=await r.FC.wycenaCore.collectQuoteData(options);
 const share=r.FC.projectPcvOverrides.withCalculationRead;
 r.FC.projectPcvOverrides.withCalculationRead=fn=>fn();
 const unshared=await r.FC.wycenaCore.collectQuoteData(options);r.FC.projectPcvOverrides.withCalculationRead=share;
 assert.equal(math(scoped),math(unshared));
});
test('Fully priced second decor retains identical complete math and exactly one PCV allowance',async()=>{
 const r=runtime();const oak=r.s.materials.filter(row=>row.name==='Oak');assert.equal(oak.length,1,'Fixture must resolve one real second decor');oak[0].price=135;
 r.s.localStorage.setItem('fc_materials_v1',JSON.stringify(r.s.materials));
 const options={pcvMode:'project',projectId:'A',selection:r.deps.getOfferDraft().selection};
 const current=await r.FC.wycenaCore.collectQuoteData(options);
 assert.equal(current.materialLines.find(x=>x.name==='Oak').unitPrice,135);
 const share=r.FC.projectPcvOverrides.withCalculationRead;r.FC.projectPcvOverrides.withCalculationRead=fn=>fn();
 const original=await r.FC.wycenaCore.collectQuoteData(options);r.FC.projectPcvOverrides.withCalculationRead=share;
 assert.equal(math(current),math(original));
 for(const row of current.materialLines.filter(x=>x.edgeRawMeters>0)){
  assert.equal(row.edgeWastePercent,10);assert.ok(Math.abs(row.edgeQuotedMeters-row.edgeRawMeters*1.1)<1e-8);
 }
});
for(const [name,mutate]of [
 ['RAM geometry',r=>{r.s.projectData.room_test_A.cabinets[0].width+=5;}],
 ['global PCV configuration',r=>{r.s.localStorage.setItem('fc_program_defaults_v1','{"changed":true}');}],
 ['canonical revision',r=>{const raw=JSON.parse(r.s.localStorage.getItem('fc_projects_v1'));raw[0].updatedAt+=1;r.s.localStorage.setItem('fc_projects_v1',JSON.stringify(raw));}],
 ['material type',r=>{r.s.materials[0].materialType='hdf';}],
 ['runtime board geometry',r=>{r.FC.materialCommon.FC_BOARD_THICKNESS_CM=2;}],
 ['RAM identity',r=>{r.s.projectData=clone(r.s.projectData);}],
 ['owner',r=>r.FC.investors.setCurrentId('inv-B')]
])test('Reentrant '+name+' mutation invalidates shared PCV read',()=>{
 const r=runtime(),api=r.FC.projectPcvOverrides;
 assert.throws(()=>api.withCalculationRead(()=>{assert.equal(api.inspectRoom('A','room_test_A').ok,true);mutate(r);return api.inspectRoom('A','room_test_A');}),e=>e.code==='PROJECT_PCV_READ_CONFLICT');
});
test('Scope cannot survive await; a later read sees fresh geometry and refuses divergence',async()=>{
 const r=runtime(),api=r.FC.projectPcvOverrides;assert.throws(()=>api.withCalculationRead(()=>Promise.resolve()),/Synchronous/);
 const address={projectId:'A',roomId:'room_test_A',cabinetId:'synth_cab_0',partRoleId:'front.door.right'};
 assert.equal(api.withCalculationRead(()=>api.getForCalculation(address)).ok,true);
 r.s.projectData.room_test_A.cabinets[0].width+=1;
 assert.equal(api.getForCalculation(address).code,'RAM_DIVERGENCE');
});

test('Delegation consumes a delayed synthetic click but accepts a new modal gesture',()=>{
 const windowHandlers={},handlers={},document={addEventListener:(type,fn)=>(handlers[type]||(handlers[type]=[])).push(fn),getElementById:()=>null};
 let calls=0,documentClicks=0;document.addEventListener('click',()=>documentClicks++,{capture:true});const host={addEventListener:(type,fn)=>(windowHandlers[type]||(windowHandlers[type]=[])).push(fn),FC:{actions:{has:()=>true,dispatch:()=>{calls++;return true;}}}};
 const fs=require('node:fs');new Function('window','document',fs.readFileSync('js/app/ui/bindings.js','utf8'))(host,document);host.FC.bindings.install();
 const action={getAttribute:()=> 'wycena-generate',closest:selector=>selector==='[data-action]'?action:null};
 const modal={closest:()=>null};
 const fire=(type,target,detail=1)=>{const e={target,detail,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;}};for(const scope of [windowHandlers,handlers]){for(const fn of scope[type]||[]){fn(e);if(e.immediate)break;}if(e.stopped)break;}return e;};
 fire('pointerdown',action);fire('pointerup',action);assert.equal(calls,1);
 assert.equal(fire('click',modal).prevented,true,'same-gesture delayed click must not reach a modal/underlying element');
 assert.equal(documentClicks,0,'window capture consumes before earlier document listeners');
 fire('pointerup',action);assert.equal(calls,2); // browser suppresses its synthetic click entirely
 fire('pointerdown',modal);fire('pointerup',modal);
 assert.equal(fire('click',modal).prevented,false,'first new physical modal gesture must be accepted');
 fire('pointerdown',action);fire('pointerup',action);fire('click',action);assert.equal(calls,3,'native pointerup/click dispatches once');
 fire('click',action,0);assert.equal(calls,4,'keyboard click remains a single ordinary document dispatch');
});

test('Generate waits for a pending local write, deduplicates gestures and never restores a deleted preview',async()=>{
 for(const changeOwner of [false,true]){
  const r=runtime();let release,notified,calls=0,prepared=0;
  const idle=new Promise(resolve=>release=resolve),notice=new Promise(resolve=>notified=resolve);
  r.state.lastQuote={id:'deleted'};r.state.previewSnapshotId='deleted';
  r.FC.infoBox={open:notified};r.FC.quoteOfferStore.prepareGeneration=async()=>{prepared++;return true;};
  r.FC.applicationWrite={whenIdle:()=>idle,async project(){calls++;throw Error('LF_IDB_ABORTED');}};
  const buttons=[];const h=(tag,attrs={})=>{const el={textContent:attrs.text||'',disabled:false,appendChild(){},setAttribute(k,v){this[k]=v;},addEventListener(){}};if(tag==='button')buttons.push(el);return el;};
  r.FC.wycenaTabShell.renderTopbar(h(),{},null,{...r.deps,h});
  const button=buttons.find(el=>el['data-action']==='wycena-generate');assert.equal(button.textContent,'Wyceń');
  r.FC.wycenaGenerateAction.run();r.FC.wycenaGenerateAction.run();
  assert.equal(button.textContent,'Liczę…','Existing busy feedback must precede waiting for any local write or remote preflight');
  assert.equal(button.disabled,true,'Repeated Calculate is disabled immediately, not after synchronization');
  r.FC.wycenaTabShell.renderTopbar(h(),{},null,{...r.deps,h});
  const refreshed=buttons.filter(el=>el['data-action']==='wycena-generate').at(-1);
  assert.equal(refreshed.textContent,'Liczę…');assert.equal(refreshed.disabled,true,'Incoming source render must not revert the pending state');
  await Promise.resolve();assert.equal(calls,0);
  r.state.lastQuote=null;r.state.previewSnapshotId='';
  if(changeOwner)r.FC.investors.setCurrentId('inv-B');
  release();await notice;
  assert.equal(calls,changeOwner?0:1);assert.equal(prepared,changeOwner?0:1);
  assert.equal(r.state.lastQuote,null);assert.equal(r.state.previewSnapshotId,'');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(button.textContent,'Wyceń');assert.equal(button.disabled,false,'A refused/changed-owner preparation restores its own button');
  assert.equal(refreshed.textContent,'Wyceń');assert.equal(refreshed.disabled,false,'Completion restores the latest rendered button as well');
 }
});
test('Synchronous catalog view normalizes each list once, rejects changes and cannot escape into async',()=>{
 const r=runtime(),api=r.FC.catalogSelectors,original=r.FC.catalogStore;
 let reads=0,price=10;
 r.FC.catalogStore={getAccessories(){reads++;return [{id:'probe',purchasePriceGross:price,unknown:{keep:true}}];}};
 assert.equal(typeof api.withReadSnapshot,'function');
 const value=api.withReadSnapshot(()=>{
  const first=api.getAccessories();first[0].purchasePriceGross=999;first[0].unknown.keep=false;
  api.withReadSnapshot(()=>assert.equal(api.getAccessories()[0].purchasePriceGross,10));
  for(let i=0;i<100;i++)assert.deepEqual(clone(api.getAccessories()),[{id:'probe',purchasePriceGross:10,unknown:{keep:true}}]);
  return 42;
 });
 assert.equal(value,42);assert.equal(reads,2,'One normalization and one final source check, regardless of consumers');
 assert.throws(()=>api.withReadSnapshot(()=>{api.getAccessories();price=20;}),/CATALOG_READ_CONFLICT/);
 assert.equal(api.getAccessories()[0].purchasePriceGross,20,'Refusal releases the old view');
 assert.throws(()=>api.withReadSnapshot(()=>Promise.resolve(true)),/CATALOG_READ_ASYNC/);
 assert.throws(()=>api.withReadSnapshot(()=>{api.getAccessories();throw Error('probe-error');}),/probe-error/);
 price=30;assert.equal(api.getAccessories()[0].purchasePriceGross,30,'No snapshot remains after an exception');
 r.FC.catalogStore=original;
});
test('Independent room labor shares verified sources and preserves complete ordinary quantities and prices',async()=>{
 const r=runtime(),fc=r.FC,s=r.s,vm=require('node:vm'),fs=require('node:fs');
 s.TextEncoder=TextEncoder;s.TextDecoder=TextDecoder;s.crypto=require('node:crypto').webcrypto;
 for(const file of ['project/project-local-room-contract','project/project-export-contract','cloud/cloud-pilot-contract','project/room-project-model','project/room-project-store','project/room-quote-sources'])vm.runInContext(fs.readFileSync('js/app/'+file+'.js','utf8'),s,{filename:file});
 const prior=fc.projectStore.getById('A');
 const records=prior.projectData.meta.roomOrder.map((id,index)=>{
  const room=clone(prior.projectData[id]);
  if(index===1){room.settings.legHeight=17;room.cabinets[0].height=95;room.cabinets[0].width=80;}
  room.fronts=room.cabinets.flatMap(cab=>fc.cabinetFronts.previewFrontsForCabinet(room,cab).map((front,index)=>({...front,id:id+'-'+cab.id+'-'+index})));
  return fc.roomProjectModel.create('inv-A',{id,baseType:'kuchnia',name:id},room);
 });
 s.localStorage.setItem('fc_projects_v1',JSON.stringify(records));fc.projectStore.setCurrentProjectId(records[0].id);s.projectData=fc.project.load();s.uiState.roomType=records[0].id;
 fc.applicationRegistry={id:'p0b-rooms-v1'};
 // This domain test exercises the real source/geometry/labor functions. The
 // external pin authority is a fixture; actual SDK/ACK proof belongs to DEMO.
 fc.roomQuoteProof={sources:async refs=>refs.map(ref=>({...ref,head:{version:1,generation:1,revisionId:'domain-fixture'},documentHash:'a'.repeat(64)}))};
 const beforeRam=JSON.stringify(s.projectData),rooms=records.slice(0,2).map(row=>row.id);
 const preparation=fc.workQuantityPrepared;let ordinary;
 try{delete fc.workQuantityPrepared;ordinary=clone(fc.projectPcvOverrides.withCalculationRead(()=>fc.wycenaCoreLabor.collectCabinetLabor(rooms)));}
 finally{fc.workQuantityPrepared=preparation;}
 let active=false,readingSource=false,captures=0,verificationCaptures=0,readLines,catalogReads=0;const source=fc.roomProjectModel.quoteSource,labor=fc.wycenaCoreLabor.collectCabinetLabor;
 const accessories=fc.catalogStore.getAccessories;
 fc.catalogStore.getAccessories=function(...args){if(active)catalogReads++;return accessories.apply(this,args);};
 fc.roomProjectModel.quoteSource=function(...args){if(active){if(readingSource)captures++;else verificationCaptures++;}return source.apply(this,args);};
 const calculationSource=fc.projectPcvOverrides.calculationSource;
 fc.projectPcvOverrides.calculationSource=function(...args){const parent=readingSource;readingSource=true;try{return calculationSource.apply(this,args);}finally{readingSource=parent;}};
 const elements=fc.wycenaCoreLines.collectElementLines,verifiedRead=fc.projectPcvOverrides.withCalculationRead;
 fc.wycenaCoreLines.collectElementLines=function(...args){active=true;return elements.apply(this,args);};
 fc.projectPcvOverrides.withCalculationRead=function(...args){const parent=active;try{return verifiedRead.apply(this,args);}finally{active=parent;}};
 fc.wycenaCoreLabor.collectCabinetLabor=function(...args){const value=labor.apply(this,args);readLines=clone(value);return value;};
 const before=s.localStorage.getItem('fc_projects_v1');
 const result=await fc.wycenaCore.collectQuoteData({pcvMode:'project',projectId:records[0].id,selection:{selectedRooms:rooms,materialScope:{kind:'all',includeFronts:true,includeCorpus:true}}});
 assert.deepEqual(readLines,ordinary,'Every collected operation, quantity, rate and source must remain identical before the ordinary schedule deduplicates shared transport');
 assert.equal(catalogReads,1,'The complete accessory list is read once during the entire synchronous phase');
 assert.ok(result.laborLines.length>0&&result.totals.grand>0);
 assert.equal(captures,rooms.length+1,'One all-room quantity source and one per selected room');
 assert.equal(verificationCaptures,3,'PCV source capture and its two fresh revision checks must remain outside the quantity-source cache');
 assert.equal(s.localStorage.getItem('fc_projects_v1'),before,'Derived calculations must not rewrite a room project');
 assert.equal(JSON.stringify(s.projectData),beforeRam,'Quoting detached independent rooms must not warm or replace the active RAM project');
 assert.equal(result.selectedRooms.length,2);
 const collectAccessories=fc.wycenaCoreLines.collectAccessories,thickness=fc.materialCommon.FC_BOARD_THICKNESS_CM;
 fc.wycenaCoreLines.collectAccessories=function(...args){const value=collectAccessories.apply(this,args);fc.materialCommon.FC_BOARD_THICKNESS_CM=2;return value;};
 try{
  await assert.rejects(fc.wycenaCore.collectQuoteData({pcvMode:'project',projectId:records[0].id,selection:{selectedRooms:rooms,materialScope:{kind:'all',includeFronts:true,includeCorpus:true}}}),error=>error.code==='PROJECT_PCV_READ_CONFLICT');
 }finally{fc.wycenaCoreLines.collectAccessories=collectAccessories;fc.materialCommon.FC_BOARD_THICKNESS_CM=thickness;}
 assert.equal(s.localStorage.getItem('fc_projects_v1'),before,'Rejected source mutation cannot publish or partially save a room');
});
(async()=>{const split=require('./ci-test-parts').select(4);let fail=0,executed=0;for(const[index,[name,fn]]of tests.entries()){if(!split.includes(index))continue;executed++;try{await fn();console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}split.verify(executed,tests.length);console.log(`Quote performance: ${executed-fail}/${executed} PASS, ${fail} FAIL`);process.exitCode=fail?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
