#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {fixture,activate,reopen,protectedSeed,tick,openAutomatically,load}=require('./project-pcv-ui-activation-smoke');
const G='fc_material_part_options_v1',P='fc_projects_v1',E='fc_edit_session_v1';
const address={projectId:'A',roomId:'room',cabinetId:'one',partRoleId:'body.side.left'};
const clone=x=>JSON.parse(JSON.stringify(x)),tests=[],test=(name,fn)=>tests.push([name,fn]);
const button=(r,label)=>r.modal().querySelectorAll('button').find(b=>b.textContent===label);
const direction=(r,key)=>r.modal().querySelectorAll('.material-part-options__choice').find(b=>b.textContent.startsWith({vertical:'Pion',horizontal:'Poziom',none:'Bez znaczenia',default:'Domyślny z materiału'}[key])).click();
const edges=r=>r.api.get(address).edges;
function setup(raw=null){const r=fixture();activate(r);if(raw!==null)r.storage.rows.set(G,raw);let cfg;const open=r.FC.materialPartOptions.openOptionsModal;r.FC.materialPartOptions.openOptionsModal=value=>{cfg=value;return open(value);};r.config=()=>cfg;r.open();return r;}
const changed=r=>{r.edge('w2',true);direction(r,'vertical');};
const retained=r=>{assert.ok(r.modal());assert.ok(r.modal().querySelector('.material-part-options__surface').classList.contains('is-vertical'));assert.equal(r.modal().querySelectorAll('input').find(i=>i.getAttribute('aria-label')==='PCV 1B').checked,true);assert.ok(button(r,'Zapisz'));};
const mutations=r=>r.storage.calls.filter(c=>[G,P].includes(c[1]));
const override=r=>r.row('A').projectData.room.production?.partOverrides?.one?.['body.side.left']?.edges;
const noGlobalDamage=(r,before)=>Object.entries(before).filter(([k])=>k!==G).forEach(([key,raw])=>assert.equal(r.storage.getItem(key),raw,key));
test('Both changes are confirmed in one save; restart and other cabinet PCV remain independent',()=>{
 const r=setup(),other=clone(r.row('A').projectData.other);changed(r);r.storage.calls.length=0;r.save();assert.equal(r.modal(),null);assert.equal(edges(r).w2,true);assert.equal(r.FC.materialPartOptions.getDirection(r.config().sig),'vertical');
 const writes=mutations(r);assert.deepEqual(writes.map(c=>c[1]),[G,P]);assert.equal(r.api.get({...address,cabinetId:'two'}).edges.w2,false);assert.equal(r.api.get({...address,partRoleId:'body.side.right'}).edges.w2,false);assert.deepEqual(r.row('A').projectData.other,other);
 assert.equal(r.session.commit(),true);const fresh=reopen(r);assert.equal(fresh.FC.projectPcvOverrides.get(address).edges.w2,true);assert.equal(fresh.FC.materialPartOptions.getDirection(r.config().sig),'vertical');
});
test('PCV only never writes grain; grain only never writes canonical PCV',()=>{
 const r=setup('{ "keep":"horizontal" }'),before=r.storage.getItem(G);r.edge('w2',true);r.storage.calls.length=0;r.save();assert.equal(r.modal(),null);assert.equal(r.storage.getItem(G),before);assert.ok(mutations(r).every(c=>c[1]===P));
 r.open();const raw=r.storage.getItem(P);direction(r,'none');r.storage.calls.length=0;r.save();assert.equal(r.storage.getItem(P),raw);assert.ok(mutations(r).every(c=>c[1]===G));assert.equal(edges(r).w2,true);
});
test('Reset PCV with grain change clears only owned edges; semantic full roundtrip preserves exact grain RAW',()=>{
 const r=setup('{ "other":"horizontal" }'),raw=r.storage.getItem(G);changed(r);r.save();r.open();button(r,'Przywróć domyślne PCV').click();direction(r,'default');r.save();assert.equal(override(r),undefined);assert.equal(r.storage.getItem(G),raw);assert.equal(r.storage.getItem('fc_edge_v1'),null);
});
test('Clean Exit and default-reset no-op perform zero begin/write',()=>{
 const r=setup();assert.ok(button(r,'Wyjdź'));assert.equal(button(r,'Zapisz'),undefined);const before=r.rows();r.storage.calls.length=0;button(r,'Wyjdź').click();assert.deepEqual(r.rows(),before);assert.equal(r.session.active,false);
 r.open();button(r,'Przywróć domyślne PCV').click();r.storage.calls.length=0;r.save();assert.equal(r.modal(),null);assert.equal(r.session.active,false);assert.deepEqual(r.storage.calls,[]);
});
test('Decline discard preserves the combined draft; confirmed Cancel writes nothing',async()=>{
 const r=setup(),before=r.rows();changed(r);button(r,'Anuluj').click();await tick();r.s.document.querySelectorAll('.confirm-box button').find(b=>b.textContent==='WRÓĆ').click();await tick();retained(r);assert.deepEqual(r.rows(),before);
 button(r,'Anuluj').click();await tick();r.s.document.querySelectorAll('.confirm-box button').find(b=>b.textContent==='✕ ANULUJ ZMIANY').click();await tick();assert.equal(r.modal(),null);assert.deepEqual(r.rows(),before);
});
test('Failed begin refuses both writes; the initial baseline and draft support safe retry',()=>{
 const r=setup(),before=r.rows();changed(r);r.storage.fail.set('set:'+E,'throw');r.save();retained(r);assert.equal(r.storage.getItem(P),before[P]);assert.equal(r.storage.getItem(G),null);const baseline=r.session.snapshot;r.storage.fail.clear();r.save();assert.equal(r.modal(),null);assert.equal(r.session.snapshot,baseline);
});
test('Global throw/false/silent failure never starts a project write or reports success',()=>{
 for(const mode of ['throw','false','noop']){
  const r=setup('{"keep":"none"}'),raw=r.storage.getItem(G),project=r.storage.getItem(P);changed(r);r.storage.fail.set('set:'+G,mode);r.storage.calls.length=0;r.save();retained(r);assert.equal(r.storage.getItem(G),raw);assert.equal(r.storage.getItem(P),project);assert.ok(mutations(r).every(c=>c[1]===G));
  r.storage.fail.clear();r.save();assert.equal(r.modal(),null);assert.equal(edges(r).w2,true);
 }
});
test('Failed confirmed project save restores exact witnessed grain RAW and preserves retry draft',()=>{
 const r=setup('{ "z":"none", "a":"horizontal" }'),raw=r.storage.getItem(G),project=r.storage.getItem(P);changed(r);r.storage.fail.set('set:'+P,'throw');r.save();retained(r);assert.equal(r.storage.getItem(G),raw);assert.equal(r.storage.getItem(P),project);assert.equal(r.session.canSaveProject(),true);
 r.storage.fail.clear();r.save();assert.equal(r.modal(),null);assert.equal(edges(r).w2,true);
});
test('Global read-back failure is compensated only after confirming our own RAW',()=>{
 const r=setup(),project=r.storage.getItem(P);changed(r);let fired=false;r.storage.onRead=key=>{if(!fired && key===G && r.storage.rows.get(G)?.includes('vertical')){fired=true;throw Error('read-back failed');}};
 r.save();retained(r);assert.equal(r.storage.getItem(G),null);assert.equal(r.storage.getItem(P),project);assert.equal(r.session.canSaveProject(),true);
});
test('A concurrent global writer is never replaced by modal compensation',()=>{
 const r=setup(),project=r.storage.getItem(P),external='{ "foreign":"none" }';changed(r);let fired=false;r.storage.onRead=key=>{if(!fired && key===G && r.storage.rows.get(G)?.includes('vertical')){fired=true;r.storage.rows.set(G,external);}};
 r.save();retained(r);assert.equal(r.storage.getItem(G),external);assert.equal(r.storage.getItem(P),project);assert.equal(r.session.canSaveProject(),false);assert.equal(r.session.commit(),false);
});
test('Concurrent unrelated room change during grain write is preserved and blocks the stale draft',()=>{
 const r=setup();changed(r);let fired=false;r.storage.onRead=key=>{
  if(!fired && key===G && r.storage.rows.get(G)?.includes('vertical')){fired=true;const rows=JSON.parse(r.storage.rows.get(P));rows.find(row=>row.id==='A').projectData.other.cabinets[0].width=75;r.storage.rows.set(P,JSON.stringify(rows));}
 };
 r.save();retained(r);assert.equal(r.storage.getItem(G),null);assert.equal(r.row('A').projectData.other.cabinets[0].width,75);assert.equal(override(r),undefined);
});
test('Global conflict after confirmed PCV is explicit partial execution with no unsafe compensation',()=>{
 const r=setup(),external='{ "newer":"horizontal" }';changed(r);let fired=false;r.storage.onRead=key=>{
  if(!fired && key===P && r.storage.rows.get(P)?.includes('partOverrides')){fired=true;r.storage.rows.set(G,external);}
 };
 r.save();retained(r);assert.equal(override(r).w2,true);assert.equal(r.storage.getItem(G),external);assert.equal(r.session.commit(),false);assert.ok(r.messages.some(m=>m.message.includes('mogły zostać zapisane')));
});
test('Failed grain compensation latches the session without silently closing or committing',()=>{
 const r=setup('{"foreign":"none"}'),project=r.storage.getItem(P);changed(r);r.storage.fail.set('set:'+P,'throw');const original=r.storage.setItem;let writes=0;
 r.storage.setItem=function(key,value){if(key===G && ++writes===2)throw Error('rollback failure');return original.call(this,key,value);};
 r.save();retained(r);assert.equal(r.storage.getItem(P),project);assert.ok(r.storage.getItem(G).includes('vertical'));assert.equal(r.session.canSaveProject(),false);assert.ok(r.messages.some(m=>m.message.includes('Dalszy zapis został wstrzymany')));
});
test('Failed project session revision keeps central PCV, compensates grain and blocks stale global Save',()=>{
 const r=setup(),ram=clone(r.s.projectData);assert.equal(r.session.begin('room'),true);changed(r);r.storage.fail.set('set:'+E,'throw');r.save();retained(r);assert.equal(override(r).w2,true);assert.equal(r.storage.getItem(G),null);assert.deepEqual(clone(r.s.projectData),ram);assert.ok(r.messages.some(m=>m.message.includes('mogły zostać zapisane')));
 r.storage.fail.clear();r.handlers['session-save']({});assert.equal(override(r).w2,true);assert.equal(r.session.commit(),false);r.save();retained(r);
});
test('Opening snapshots reject changed global RAW even for PCV-only save',()=>{
 const r=setup();r.edge('w2',true);const external='{"foreign":"horizontal"}';r.storage.rows.set(G,external);const project=r.storage.getItem(P);r.save();assert.ok(r.modal());assert.equal(r.storage.getItem(P),project);assert.equal(r.storage.getItem(G),external);assert.equal(r.session.active,false);
});
test('A stale MATERIAL row cannot open a map or grain signature from old cabinet dimensions',()=>{
 const r=fixture();activate(r);const oldButton=r.rowNode('body.side.left').querySelector('[data-part-options]');assert.equal(r.session.begin('room'),true);
 const next=clone(r.s.projectData);next.room.cabinets[0].height=90;const saved=r.FC.project.saveConfirmed(next);assert.equal(saved.ok,true);r.s.projectData=saved.project;
 oldButton.click();assert.equal(r.modal(),null);assert.ok(r.messages.some(m=>m.message.includes('PROJECT_WRITE_CONFLICT')));
 r.open();assert.ok(r.modal());
});
test('Changed canonical record, stale RAM and removed owner refuse before any grain mutation',()=>{
 for(const kind of ['record','ram','owner']){
  const r=setup();changed(r);
  if(kind==='ram')r.s.projectData.room.cabinets[0].width=65;else{const row=r.FC.projectStore.getById('A');if(kind==='owner')row.projectData.room.cabinets.shift();else row.projectData.meta.note='newer';assert.ok(r.FC.projectStore.upsert(row));r.s.projectData=r.FC.project.load();}
  const project=r.storage.getItem(P);r.save();retained(r);assert.equal(r.storage.getItem(G),null);assert.equal(r.storage.getItem(P),project);
 }
});
test('Grain-only mode still validates project owner and refuses foreign edit-room context',()=>{
 const r=setup();direction(r,'horizontal');r.s.uiState.roomType='other';const before=r.rows();r.save();assert.ok(r.modal());assert.deepEqual(r.rows(),before);
});
test('Malformed grain store is preserved instead of being overwritten by defaults',()=>{
 const r=setup('{broken');r.edge('w2',true);const project=r.storage.getItem(P);r.save();assert.ok(r.modal());assert.equal(r.storage.getItem(G),'{broken');assert.equal(r.storage.getItem(P),project);
});
test('Global catalogs, dictionaries, settings and history remain byte-identical through success and failure',()=>{
 for(const failed of [false,true]){
  const r=fixture(),before=protectedSeed(r);r.storage.rows.delete(G);before[G]=null;activate(r);r.open();changed(r);if(failed)r.storage.fail.set('set:'+P,'throw');r.save();noGlobalDamage(r,before);assert.equal(r.storage.getItem('fc_edge_v1'),before.fc_edge_v1);
 }
});
test('Global Cancel retains its grain safety block; exact grain revert then permits owned PCV rollback',()=>{
 const r=setup('{ "foreign":"horizontal" }'),raw=r.storage.getItem(G),b=clone(r.row('B')),other=clone(r.row('A').projectData.other);changed(r);r.save();
 const snapshot=r.session.snapshot,project=r.storage.getItem(P),grain=r.storage.getItem(G);
 assert.equal(r.session.cancel(),false);assert.equal(r.session.lastError.code,'UNSCOPED_PART_ROLLBACK_BLOCKED');assert.equal(r.session.snapshot,snapshot);assert.equal(r.storage.getItem(P),project);assert.equal(r.storage.getItem(G),grain);
 r.open();direction(r,'default');r.save();assert.equal(r.storage.getItem(G),raw);assert.equal(r.session.cancel(),true);r.s.projectData=r.FC.project.load();assert.equal(override(r),undefined);assert.deepEqual(r.row('B'),b);assert.deepEqual(r.row('A').projectData.other,other);
});

// The browser runs appView's capture listener BEFORE the Options button opens
// panelBox. MiniDocument has neither event propagation nor closest(), so model
// those two DOM capabilities here; keep the actual autosave/store/session code.
function autosavedEditor(){
 const r=fixture();assert.equal(openAutomatically(r),true);r.render();
 const root=r.s.document.getElementById('appView');r.list.parentNode.removeChild(r.list);root.appendChild(r.list);
 const pending=new Map();let timerId=0;
 r.s.setTimeout=(fn,ms)=>{pending.set(++timerId,{fn,ms});return timerId;};r.s.clearTimeout=id=>pending.delete(id);
 load(r,'js/app/investor/project-autosave.js');r.FC.projectAutosave.installProjectAutosave();
 let cfg;const open=r.FC.materialPartOptions.openOptionsModal;r.FC.materialPartOptions.openOptionsModal=value=>{cfg=value;return open(value);};r.config=()=>cfg;
 const openButton=r.rowNode('body.side.left').querySelector('[data-part-options]');
 openButton.closest=function(selector){for(let n=this;n;n=n.parentNode){
  if(selector==='button'&&n.tagName==='BUTTON' || selector.startsWith('.')&&n.classList.contains(selector.slice(1))
   || selector.startsWith('#')&&n.id===selector.slice(1) || selector.startsWith('[')&&n.getAttribute(selector.slice(1,-1))!==null)return n;
 }return null;};
 r.captureOpen=()=>{root.dispatchEvent({type:'click',target:openButton});openButton.click();};
 r.flushAutosave=()=>{
  const before=r.FC.projectStore.getById('A');r.s.Date=class extends Date {static now(){return before.updatedAt+1000;}};
  assert.ok([...pending.values()].some(t=>t.ms===180),'real capture click must schedule autosave');
  for(const[id,t]of pending)if(t.ms===180){pending.delete(id);t.fn();}
  const after=r.FC.projectStore.getById('A');
  assert.deepEqual(Object.keys(before).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])),['updatedAt']);
  assert.deepEqual(after.projectData,before.projectData);assert.ok(r.session.inspectNavigationState());
 };
 r.captureOpen();assert.ok(r.modal());return r;
}
test('Android clean Options -> autosave -> Exit -> same rendered Options reopens without conflict',()=>{
 const r=autosavedEditor(),snapshot=r.session.snapshot;r.flushAutosave();button(r,'Wyjdź').click();assert.equal(r.modal(),null);
 r.storage.calls.length=0;r.captureOpen();assert.ok(r.modal(),'timestamp-only autosave must not stale the rendered row');
 assert.equal(r.session.snapshot,snapshot);assert.equal(r.storage.calls.length,0);assert.equal(r.messages.length,0);
});
test('Android capture autosave does not reject PCV-only, grain-only or combined Save and rerender/reopen',()=>{
 for(const mode of ['pcv','grain','both']){
  const r=autosavedEditor();r.flushAutosave();const before=clone(r.row('A').projectData);
  if(mode!=='grain')r.edge('h2',true);if(mode!=='pcv')direction(r,'vertical');
  r.save();assert.equal(r.modal(),null,mode+' save after real autosave must succeed');
  assert.equal(edges(r).h2,mode!=='grain');if(mode==='grain')assert.deepEqual(r.row('A').projectData,before);
  r.rowNode('body.side.left').querySelector('[data-part-options]').click();assert.ok(r.modal(),'freshly rendered Save callback must reopen without a manual render');assert.equal(r.modal().querySelectorAll('input').find(i=>i.getAttribute('aria-label')==='PCV 2B').checked,mode!=='grain');
  assert.equal(r.FC.materialPartOptions.getDirection(r.config().sig),mode==='pcv'?'default':'vertical');
  r.FC.panelBox.close();assert.equal(r.session.commit(),true);
  const fresh=reopen(r,true);assert.equal(fresh.FC.projectPcvOverrides.get(address).edges.h2,mode!=='grain');fresh.render();fresh.rowNode('body.side.left').querySelector('[data-part-options]').click();assert.ok(fresh.modal());assert.equal(fresh.modal().querySelectorAll('input').find(i=>i.getAttribute('aria-label')==='PCV 2B').checked,mode!=='grain');
 }
});
test('Failed PCV save after capture autosave retains draft, reports code and allows a confirmed retry',()=>{
 const r=autosavedEditor();r.flushAutosave();r.edge('h2',true);const before=r.storage.getItem(P);
 r.storage.fail.set('set:'+P,'throw');r.save();assert.ok(r.modal());assert.equal(r.storage.getItem(P),before);
 assert.equal(r.modal().querySelectorAll('input').find(i=>i.getAttribute('aria-label')==='PCV 2B').checked,true);
 assert.ok(r.messages.some(m=>m.message.includes('(SAVE_FAILED)')),'existing failure must expose the actual diagnostic code');
 r.storage.fail.clear();r.save();assert.equal(r.modal(),null);assert.equal(edges(r).h2,true);r.open();assert.ok(r.modal());
});
test('A real concurrent data change after autosave still refuses the opened draft and preserves the newer project',()=>{
 const r=autosavedEditor();r.flushAutosave();r.edge('h2',true);const rows=JSON.parse(r.storage.getItem(P));
 rows.find(row=>row.id==='A').projectData.room.cabinets[0].width=75;r.storage.rows.set(P,JSON.stringify(rows));
 const before=r.rows();r.save();assert.ok(r.modal());assert.deepEqual(r.rows(),before);
 assert.equal(r.row('A').projectData.room.cabinets[0].width,75);assert.equal(override(r),undefined);
});

test('Only updatedAt is ignored: changed title, status, creation time and metadata remain real conflicts',()=>{
 for(const field of ['title','status','createdAt','meta']){
  const r=autosavedEditor();r.flushAutosave();r.edge('h2',true);const record=r.FC.projectStore.getById('A');
  if(field==='meta')record.meta.note='newer';else if(field==='createdAt')record.createdAt+=1;else record[field]='newer';
  assert.ok(r.FC.projectStore.upsert(record));const before=r.rows();r.save();assert.ok(r.modal());assert.deepEqual(r.rows(),before);
  assert.ok(r.messages.some(m=>m.message.includes('(PROJECT_WRITE_CONFLICT)')));assert.equal(override(r),undefined);
 }
});

(async()=>{let failures=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);process.exitCode=failures?1:0;})();
