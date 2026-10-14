#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup,quoteSetup,worker,load,seed,drawers,select,address}=require('./project-calculation-adapters-smoke');
const {runtime}=require('./project-session-owner-rollback-smoke');
const {group}=require('./effective-project-pcv-smoke');
const ROOT=path.resolve(__dirname,'..'),tests=[],test=(name,fn)=>tests.push([name,fn]),clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`),tick=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
const edgeInput=(node,code)=>node.querySelectorAll('input').find(input=>input.getAttribute('aria-label')==='PCV '+code);
const btn=(node,text)=>node.querySelectorAll('button').find(b=>b.textContent===text);
function install(r){
 r.s.Node=r.s.document.createElement('div').constructor;
 for(const f of ['js/app/project/project-pcv-policy.js','js/app/ui/panel-box.js','js/app/ui/confirm-box.js','js/app/ui/choice-box.js','js/tabs/material.js'])load(r,f);
 r.s.FC_BOARD_THICKNESS_CM=1.8;r.s.FC_TOP_TRAVERSE_DEPTH_CM=10;r.s.uiState.activeTab='material';r.s.uiState.entry='app';r.s.uiState.currentInvestorId='inv-A';r.s.uiState.matExpandedId='one';
 const list=r.s.document.createElement('div');r.s.document.body.appendChild(list);r.list=list;
 r.render=()=>{list.innerHTML='';r.FC.tabsMaterial.renderMaterialsTab(list,r.s.uiState.roomType);};r.s.renderCabinets=r.render;
 r.modal=()=>r.s.document.querySelector('.panel-box');
 r.rowNode=(role,id='one',owner='cabinet')=>list.querySelectorAll('[data-pcv-owner]').find(row=>{const a=JSON.parse(row.getAttribute('data-pcv-owner'));return (a.partRoleId||a.groupRoleId)===role&&(owner==='set'?a.setId===id:a.cabinetId===id);});
 r.open=(role='body.side.left',id='one',owner='cabinet')=>{r.s.uiState.matExpandedId=owner==='set'?'one':id;r.render();const row=r.rowNode(role,id,owner);assert.ok(row,role+' not rendered: '+list.textContent);row.querySelector('[data-part-options]').click();assert.ok(r.modal());return r.modal();};
 r.edge=(key,checked)=>{const input=edgeInput(r.modal(),{w1:'1A',w2:'1B',h1:'2A',h2:'2B'}[key]);assert.ok(input);input.checked=checked;input.dispatchEvent({type:'change'});return input;};
 r.save=()=>{const button=btn(r.modal(),'Zapisz');assert.ok(button);button.click();};
 r.FC.investorProjectPatches.patchInvestorsAPI();
 r.policy=r.FC.projectPcvPolicy;return r;
}
function fixture(){return install(quoteSetup(setup()));}
function activate(r){const result=r.policy.activate();assert.equal(result.ok,true,JSON.stringify(result));r.render();}
function openAutomatically(r){return r.FC.sessionNavigation.prepareEditState({...r.s.uiState,entry:'app',activeTab:'material',roomType:'room'},true);}
async function legacyCandidate(r){
 // A frozen pre-switch fixture; explicit adapter mode never activates a project.
 const snapshot=r.FC.quoteSnapshot.buildSnapshot(await r.FC.wycenaCore.collectQuoteData({pcvMode:'project',projectId:'A'}));
 return r.FC.projectPcvResolver.stripQuoteProof(snapshot);
}
function canonical(r,role='body.side.left',cab='one',space='partOverrides'){return r.row('A').projectData.room.production?.[space]?.[cab]?.[role]?.edges;}
function reopen(r){const fresh=runtime(r.rows()); // Real store, bridge, session restoration, then real production/domain/UI modules.
 fresh.s.materials=clone(r.s.materials);fresh.s.uiState.roomType='room';
 // Reuse the actual static dependencies, not previous APIs/closures.
 for(const f of ['js/app/cabinet/part-provenance.js','js/app/material/material-common.js','js/app/cabinet/front-hardware-fronts.js','js/app/cabinet/cabinet-cutlist.js','js/app/material/material-part-options.js','js/app/material/material-edge-store.js','js/app/cabinet/cabinet-derived-facts.js','js/app/material/material-tab-data.js','js/app/project/project-pcv-overrides.js','js/app/project/project-pcv-resolver.js','js/app/project/project-pcv-policy.js'])load(fresh,f);
 return fresh;
}
function protectedSeed(r){for(const key of ['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_program_defaults_v1','fc_quote_snapshots_v1','fc_price_list_v1','fc_catalog_materials_v1'])r.storage.rows.set(key,'{"preserve":true}');return Object.fromEntries([...r.storage.rows].filter(([key])=>key!=='fc_projects_v1'));}
function quotedUI(r){const state={},card=r.s.document.createElement('div');r.s.document.body.appendChild(card);
 const deps={h:(tag,attrs)=>{const el=r.s.document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='text')el.textContent=v;else if(k==='class')el.className=v;else el.setAttribute(k,v);}return el;},getState:()=>state,setState:p=>Object.assign(state,p),render(){},normalizeDraftSelection:d=>d.selection,getOfferDraft:()=>r.draft,
 ensureVersionNameBeforeGenerate:async()=>({cancelled:false}),getSnapshotId:q=>q.id,syncGeneratedQuoteStatus(){},getProjectStatusForHistory:()=>'',getSnapshotHistory:()=>r.FC.quoteSnapshotStore.listForProject('A')};
 r.FC.wycenaTabShell.renderTopbar(card,{},null,deps);
 // Same data-action entry used by the production actions registry (event delegation).
 card.querySelector('[data-action="wycena-generate"]').addEventListener('click',event=>r.FC.wycenaGenerateAction.run(event));
 return {state,button:card.querySelector('[data-action="wycena-generate"]')};
}
test('1 Unmarked render refuses legacy and never migrates or presents an activation control',()=>{
 const r=fixture(),before=r.rows();r.render();assert.equal(r.policy.read().ok,false);assert.equal(r.list.querySelector('.material-project-pcv-activate'),null);assert.equal(r.list.querySelector('[data-part-options]'),null);assert.deepEqual(r.rows(),before);
});
test('2 Room opening confirms automatic marker before durable baseline, with no activation dialog',()=>{
 const r=fixture();assert.equal(openAutomatically(r),true);r.render();
 assert.equal(r.row('A').projectData.meta.productionPcvMode,'project');assert.equal(r.policy.read().mode,'project');assert.equal(r.list.querySelector('.material-project-pcv-activate'),null);assert.equal(r.s.document.querySelector('.confirm-box'),null);assert.ok(r.list.textContent.includes('ustawienia tego projektu'));
 assert.equal(JSON.parse(r.session.snapshot.fc_projects_v1).find(row=>row.id==='A').projectData.meta.productionPcvMode,'project');
});
test('3 Missing physical owner refuses automatic opening without writes',()=>{
 const r=fixture();r.FC.projectStore.setCurrentProjectId('');const before=r.rows();r.storage.calls.length=0;assert.equal(openAutomatically(r),false);assert.deepEqual(r.rows(),before);assert.equal(r.storage.calls.length,0);
});
test('4 Active unmarked session is preserved and refused; completion permits automatic opening',()=>{
 const r=fixture();assert.equal(r.session.begin('room'),true);const before=r.rows();assert.equal(openAutomatically(r),false);assert.deepEqual(r.rows(),before);assert.equal(r.session.active,true);
 assert.equal(r.session.commit(),true);assert.equal(openAutomatically(r),true);assert.equal(r.session.durable,true);assert.equal(JSON.parse(r.session.snapshot.fc_projects_v1).find(row=>row.id==='A').projectData.meta.productionPcvMode,'project');
});
test('5 Failed automatic marker save refuses opening, preserves RAM and allows retry',()=>{
 const r=fixture(),before=r.row('A'),ram=clone(r.s.projectData);r.storage.fail.set('set:fc_projects_v1','throw');assert.equal(openAutomatically(r),false);assert.deepEqual(r.row('A'),before);assert.deepEqual(clone(r.s.projectData),ram);assert.equal(r.policy.read().ok,false);r.storage.fail.clear();assert.equal(openAutomatically(r),true);
});
test('6 Confirmed marker survives real restart and is preserved by normalization',()=>{
 const r=fixture();activate(r);const next=reopen(r);assert.equal(next.FC.projectPcvPolicy.read().mode,'project');assert.equal(next.FC.project.load().meta.productionPcvMode,'project');
});
test('7 Two physical projects have independent policy and overrides',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();assert.equal(r.session.commit(),true);
 r.FC.investors.setCurrentId('inv-B');r.FC.projectStore.setCurrentProjectId('B');r.s.projectData=r.FC.project.load();assert.equal(r.policy.read().mode,'project');assert.equal(r.row('B').projectData.meta.productionPcvMode,'project');assert.equal(r.row('B').projectData.room.production,undefined);
 r.FC.investors.setCurrentId('inv-A');r.FC.projectStore.setCurrentProjectId('A');r.s.projectData=r.FC.project.load();assert.equal(r.policy.read().mode,'project');assert.equal(canonical(r).w2,true);
});
test('8 Left and right sides are separate visible controls; saved left does not alter right',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();assert.equal(r.modal(),null);assert.equal(canonical(r).w2,true);assert.equal(r.api.get(address('one','body.side.right')).edges.w2,false);assert.ok(r.rowNode('body.side.left').textContent.includes('lewy'));assert.ok(r.rowNode('body.side.right').textContent.includes('prawy'));
});
test('9 Identical second cabinet remains independent in the real MATERIAL table',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.open('body.side.left','two');assert.equal(edgeInput(r.modal(),'1B').checked,false);assert.equal(r.api.get(address('two')).edges.w2,false);
});
test('10 Shelves x3 and x5 preserve one group and inherited edges in UI',()=>{
 const r=fixture();seed(r,p=>p.room.cabinets[0].details.shelves=3);activate(r);r.open('body.shelves');r.edge('w2',true);r.save();assert.equal(r.api.get(group()).edges.w2,true);
 const next=clone(r.s.projectData);next.room.cabinets[0].details.shelves=5;const saved=r.FC.project.saveConfirmed(next);assert.equal(saved.ok,true);r.s.projectData=saved.project;r.open('body.shelves');assert.equal(edgeInput(r.modal(),'1B').checked,true);assert.equal(r.rowNode('body.shelves').children[1].textContent,'5');
});
test('11 Small front and large fronts x2 use independent groups without changing geometry',()=>{
 const r=fixture();drawers(r);activate(r);r.open('front.drawer.small');r.edge('w1',false);r.save();r.open('front.drawer.large');assert.equal(edgeInput(r.modal(),'1A').checked,true);assert.equal(r.rowNode('front.drawer.large').children[1].textContent,'2');assert.equal(canonical(r,'front.drawer.small','one','cabinetGroupOverrides').w1,false);
});
test('12 Shared set fronts persist setId ownership, independent of cabinet order',()=>{
 const r=fixture();seed(r,p=>{p.room.cabinets.forEach(c=>c.setId='set');p.room.sets=[{id:'set',presetId:'A',frontCount:2,params:{w1:30,w2:30,hB:80,hTop:20}}];});activate(r);
 const owner=r.list.querySelectorAll('[data-pcv-owner]').map(row=>JSON.parse(row.getAttribute('data-pcv-owner'))).find(a=>a.ownerType==='set');assert.ok(owner);r.open(owner.groupRoleId,'set','set');r.edge('w1',false);r.save();assert.equal(r.row('A').projectData.room.production.setGroupOverrides.set[owner.groupRoleId].edges.w1,false);
});
test('13 Saved PCV reopens with confirmed flags and survives Save plus restart',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.open();assert.equal(edgeInput(r.modal(),'1B').checked,true);r.FC.panelBox.close();r.handlers['session-save']({});assert.equal(r.session.active,false);
 const fresh=reopen(r);assert.equal(fresh.FC.projectPcvOverrides.get(address()).edges.w2,true);
});
test('14 Restore defaults clears only addressed edges and refreshes technological flags',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.open('body.side.right');r.edge('h1',true);r.save();r.open();btn(r.modal(),'Przywróć domyślne PCV').click();assert.equal(edgeInput(r.modal(),'1B').checked,false);r.save();assert.equal(canonical(r),undefined);assert.equal(canonical(r,'body.side.right').h1,true);
});
test('15 Local Cancel confirms discard and causes no central mutation',async()=>{
 const r=fixture();activate(r);const before=r.rows();r.open();r.edge('w2',true);btn(r.modal(),'Anuluj').click();await tick();btn(r.s.document.querySelector('.confirm-box'),'✕ ANULUJ ZMIANY').click();await tick();assert.equal(r.modal(),null);assert.deepEqual(r.rows(),before);
});
test('16 Failed confirmed PCV save preserves open editor, draft and current project',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);const before=r.row('A');r.storage.fail.set('set:fc_projects_v1','throw');r.save();assert.ok(r.modal());assert.equal(edgeInput(r.modal(),'1B').checked,true);assert.deepEqual(r.row('A'),before);r.storage.fail.clear();r.save();assert.equal(r.modal(),null);assert.equal(canonical(r).w2,true);
});
test('17 Failed session revision reports partial state and blocks stale RAM save/commit',()=>{
 const r=fixture();activate(r);assert.equal(r.session.begin('room'),true);r.open();r.edge('w2',true);r.storage.fail.set('set:fc_edit_session_v1','throw');r.save();assert.ok(r.modal());assert.equal(canonical(r).w2,true);assert.ok(r.messages.some(m=>m.message.includes('mogły zostać zapisane')));r.storage.fail.clear();r.handlers['session-save']({});assert.equal(canonical(r).w2,true);assert.equal(r.session.commit(),false);r.save();assert.ok(r.modal());
});
test('18 Project PCV edit is isolated from grain and rotation with no legacy writes',()=>{
 const r=fixture();activate(r);const keys=['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1'];keys.forEach(key=>r.storage.rows.set(key,'{"keep":true}'));const before=keys.map(key=>r.storage.getItem(key));r.open();assert.equal(r.modal().querySelectorAll('.material-part-options__choice').length,4);r.edge('w2',true);r.save();keys.forEach((key,i)=>assert.equal(r.storage.getItem(key),before[i]));
});
test('19 Legacy PCV setter and stale combined modal cannot write in project mode',()=>{
 const r=fixture(),legacy=r.FC.materialEdgeStore.createEdgeStore(),p=r.parts().find(p=>p.name==='Bok'),sig=r.FC.materialEdgeStore.signatureFromPart(p);legacy.getEdges(sig,p,r.cab());activate(r);const before=r.storage.getItem('fc_edge_v1');assert.equal(legacy.setEdges(sig,{w2:true}),false);
 assert.equal(r.FC.materialPartOptions.saveDraft(sig,{direction:'default',edges:{w1:true,w2:false,h1:false,h2:false}},{direction:'default',edges:{w1:true,w2:true,h1:false,h2:false}},{prepare:()=>{throw Error('legacy planner invoked');}}),false);assert.equal(r.storage.getItem('fc_edge_v1'),before);
});
test('20 Activation preserves every global setting, catalog, price and history byte-for-byte',()=>{
 const r=fixture(),before=protectedSeed(r);activate(r);r.open();r.edge('w2',true);r.save();for(const[key,raw]of Object.entries(before))assert.equal(r.storage.getItem(key),raw,key);
});
test('21 MATERIAL shows raw 16.440 then 17.122 mb, matching visible independent edges',()=>{
 const r=fixture();activate(r);near(r.FC.materialTabData.collectRoomMaterials('room').projectEdgeMeters,16.44);r.open();r.edge('w2',true);r.save();near(r.FC.materialTabData.collectRoomMaterials('room').projectEdgeMeters,17.122);assert.ok(r.list.querySelector('#projectEdgeTotals').textContent.includes('17.122'));assert.ok(r.rowNode('body.side.left').textContent.includes('1A, 1B'));assert.ok(!r.rowNode('body.side.right').textContent.includes('1A, 1B'));
});
function rozUI(r,asyncEngine=false){
 for(const f of ['js/app/rozrys/rozrys-project-source.js','js/app/rozrys/rozrys-prefs.js','js/app/rozrys/rozrys-validation.js','js/app/rozrys/rozrys-render.js','js/app/rozrys/rozrys-print.js','js/app/rozrys/rozrys-lazy-manifest.js'])load(r,f);
 for(const f of r.FC.rozrysLazyManifest.scripts)load(r,f.split('?')[0]);const root=r.s.document.createElement('div');root.id='rozrysRoot';r.s.document.body.appendChild(root);
 r.FC.rozrys.render();if(!asyncEngine){ // Choose sync through the existing testable adapter, no mode flag supplied.
  const generate=r.FC.rozrysRunner.generate;r.FC.rozrysRunner.generate=(force,cfg)=>generate(force,Object.assign({},cfg,{engineMode:'sync'}));
 }else{worker(r);r.s.document.getElementById('rozHeur').value='turbo';}
 let pending;const generate=r.FC.rozrysRunner.generate;r.FC.rozrysRunner.generate=(...args)=>{pending=generate(...args);return pending;};root.querySelector('.rozrys-action-btn--generate').click();return {root,done:()=>pending};
}
test('22 Normal ROZRYS launch follows marker, shows actual project flags and preserves sources',async()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();assert.equal(r.session.commit(),true);const x=rozUI(r);assert.notEqual(await x.done(),false);const placed=x.root.querySelectorAll('canvas').flatMap(c=>c.__rozrysDrawPayload.sheet.placements);assert.ok(placed.length);assert.ok(placed.every(p=>p.effectivePcv.projectId==='A'));assert.equal(placed.filter(p=>p.name==='Bok'&&p.effectivePcv.edges.w2).length,1);
});
test('23 Normal Optimax worker agrees technologically with standard engine',async()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.session.commit();const x=rozUI(r,true);assert.notEqual(await x.done(),false);const placed=x.root.querySelectorAll('canvas').flatMap(c=>c.__rozrysDrawPayload.sheet.placements);near(placed.reduce((n,p)=>n+p.effectivePcv.total,0),17.122);
});
test('24 Source/policy mismatch stops ROZRYS and cannot fall back to legacy',()=>{
 const r=fixture();activate(r);r.s.projectData.meta.productionPcvMode=undefined;load(r,'js/app/rozrys/rozrys-project-source.js');load(r,'js/app/rozrys/rozrys.js');const root=r.s.document.createElement('div');root.id='rozrysRoot';r.s.document.body.appendChild(root);assert.equal(r.FC.rozrys.render(),false);assert.equal(root.querySelectorAll('canvas').length,0);assert.ok(root.textContent.includes('PCV_POLICY_MISMATCH'));
});
test('25 Normal ROZRYS lists and CSV carry actual cutting dimensions and ledger',async()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.session.commit();const x=rozUI(r);await x.done();const canvases=x.root.querySelectorAll('canvas');for(const c of canvases){const payload=c.__rozrysDrawPayload;assert.ok(payload.sheet.placements.every(p=>p.effectivePcv&&p.sourceRefs.length+p.sourceGroups.reduce((n,g)=>n+g.qty,0)===1));const csv=r.FC.rozrysPrint.buildCsv([payload.sheet],{edgeSubMm:1});assert.equal(csv.split('\n').length,payload.sheet.placements.length+1);}assert.ok(x.root.textContent.includes('Arkusz 1'));
});
test('26 Ordinary quote button uses project 17.122 ->18.834 mb at unchanged price',async()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.session.commit();const q=quotedUI(r);q.button.click();await tick();assert.ok(q.state.lastQuote&&!q.state.lastQuote.error,JSON.stringify(q.state));const line=q.state.lastQuote.lines.materials.find(l=>l.name.includes('PCV'));near(line.qty,18.834);assert.equal(line.unitPrice,3);near(line.total,56.5);assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,1);
});
test('27 Ordinary quote for drawer fronts applies one 10% allowance and front rate',async()=>{
 const r=fixture();drawers(r);seed(r,p=>p.room.cabinets[0].bodyPcvMode='front');activate(r);r.draft.selection=select(['room'],{includeCorpus:false});const q=quotedUI(r);q.button.click();await tick();const line=q.state.lastQuote.lines.materials.find(l=>l.name.includes('PCV'));near(line.qty,5.511);assert.equal(line.unitPrice,5);near(line.total,27.56);
});
test('28 Ordinary duplicate replace after PCV change rejects candidate and preserves history',async()=>{
 const r=fixture();activate(r);const q=quotedUI(r);q.button.click();await tick();const history=r.storage.getItem('fc_quote_snapshots_v1');r.FC.wycenaTabShell._generateRuntime.lastAcceptedAt=0;r.FC.wycenaTabShell._generateRuntime.lastReleasedAt=0;q.button.click();await tick();assert.ok(r.s.document.querySelector('.confirm-box'));r.FC.projectPcvOverrides.setEdges(address(),{w2:true});r.session.commit();btn(r.s.document.querySelector('.confirm-box'),'Zamień istniejącą').click();await tick();assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),history);assert.ok(q.state.lastQuote.error);
});
test('29 A, B and A+B normal calculations retain exact scope and sums',async()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.session.commit();for(const[rooms,want]of [[['room'],17.122],[['other'],8.22],[['room','other'],25.342]]){r.draft.selection=select(rooms);const data=await r.FC.wycenaCore.collectQuoteData();near(data.materialLines.filter(l=>l.priceUnit==='mb').reduce((n,l)=>n+l.edgeRawMeters,0),want);r.FC.quoteSnapshotStore.save(r.FC.quoteSnapshot.buildSnapshot(data));}assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,3);
});
test('30 Active or unconfirmed edit blocks normal quote generation without history write',async()=>{
 const r=fixture();activate(r);r.session.begin('room');const q=quotedUI(r);q.button.click();await tick();assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);r.storage.rows.delete('fc_edit_session_v1');q.button.click();await tick();assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
test('31 Historical offers stay immutable and readable after current PCV changes',async()=>{
 const r=fixture();activate(r);const q=quotedUI(r);q.button.click();await tick();const history=r.storage.getItem('fc_quote_snapshots_v1');r.open();r.edge('w2',true);r.save();r.session.commit();assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),history);assert.ok(r.FC.quoteSnapshotStore.getById(q.state.lastQuote.id));
});
test('32 One Options button opens both controls; grain-only save leaves project PCV unchanged',()=>{
 const r=fixture();activate(r);r.render();const row=r.rowNode('body.side.left');assert.equal(row.querySelector('[data-grain-options]'),null);assert.equal(row.querySelector('[data-part-options]').textContent,'Opcje');r.open();
 assert.ok(r.modal().textContent.includes('Opcje formatki'));assert.equal(r.modal().querySelectorAll('.material-part-options__choice').length,4);assert.ok(r.modal().querySelectorAll('input').every(i=>i.getAttribute('disabled')===null));const before=r.row('A');
 const vertical=r.modal().querySelectorAll('.material-part-options__choice').find(b=>b.textContent.startsWith('Pion'));vertical.click();r.save();assert.deepEqual(r.row('A'),before);assert.equal(r.storage.getItem('fc_edge_v1'),null);assert.ok(r.storage.getItem('fc_material_part_options_v1'));
});
test('33 Failed begin retains PCV draft with no project mutation, then allows safe retry',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);const before=r.row('A');r.storage.fail.set('set:fc_edit_session_v1','throw');r.save();assert.ok(r.modal());assert.deepEqual(r.row('A'),before);r.storage.fail.clear();r.save();assert.equal(r.modal(),null);assert.equal(canonical(r).w2,true);
});
test('34 Automatic opening retains legacy RAW but uses technological defaults without importing it',()=>{
 const r=fixture(),sig=r.FC.materialEdgeStore.signatureFromPart(r.parts().find(p=>p.name==='Bok')),raw=JSON.stringify({[sig]:{w1:false,w2:false,h1:false,h2:false}});r.storage.rows.set('fc_edge_v1',raw);assert.equal(openAutomatically(r),true);r.render();near(r.FC.materialTabData.collectRoomMaterials('room').projectEdgeMeters,16.44);assert.equal(r.storage.getItem('fc_edge_v1'),raw);assert.equal(r.row('A').projectData.meta.productionPcvMode,'project');
});
test('35 Failed activation read-back preserves RAM and blocks stale write despite central marker',()=>{
 const r=fixture(),ram=JSON.stringify(r.s.projectData);let fired=false;r.storage.onRead=key=>{if(!fired&&key==='fc_projects_v1'&&r.storage.rows.get(key).includes('productionPcvMode')){fired=true;throw Error('read-back failed');}};
 const result=r.policy.activate();assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.equal(JSON.stringify(r.s.projectData),ram);assert.equal(r.session.canSaveProject(),false);assert.equal(r.policy.read().ok,false);
});
test('36 Cancel removes only owned PCV while marker and other room survive',()=>{
 const r=fixture();activate(r);const other=clone(r.row('A').projectData.other);r.open();r.edge('w2',true);r.save();assert.equal(r.session.cancel(),true);r.s.projectData=r.FC.project.load();assert.equal(canonical(r),undefined);assert.equal(r.policy.read().mode,'project');assert.deepEqual(r.row('A').projectData.other,other);
});
test('37 Automatic lifecycle never discards dirty RAM or creates an activation dialog',()=>{
 const r=fixture();r.session.begin('room');r.s.projectData.room.cabinets[0].width=65;const snapshot=r.session.snapshot,before=r.rows();assert.equal(openAutomatically(r),false);r.render();assert.equal(r.s.document.querySelector('.confirm-box'),null);assert.equal(r.cab().width,65);assert.equal(r.session.snapshot,snapshot);assert.deepEqual(r.rows(),before);
});
test('38 Pre-activation legacy candidate cannot be newly saved after project activation',async()=>{
 const r=fixture(),candidate=await legacyCandidate(r);activate(r);
 assert.throws(()=>r.FC.quoteSnapshotStore.save(candidate),e=>e.code==='PROJECT_PCV_QUOTE_PROOF_REQUIRED');assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
test('39 Historical frozen offer metadata remains editable without recalculation proof',async()=>{
 const r=fixture();activate(r);const q=quotedUI(r);q.button.click();await tick();const old=r.FC.quoteSnapshotStore.getById(q.state.lastQuote.id),before=JSON.stringify(old.lines);
 old.commercial.versionName='Historia — zmiana nazwy';r.FC.quoteSnapshotStore.save(old);assert.equal(JSON.stringify(r.FC.quoteSnapshotStore.getById(old.id).lines),before);
});
test('40 Stale legacy runner opened before activation cannot use legacy cached placements',async()=>{
 const r=fixture(),{runner}=require('./project-calculation-adapters-smoke');const run=runner(r,{pcvMode:undefined,projectId:undefined,engineMode:'sync'});activate(r);assert.equal(await run.run(),false);assert.equal(run.rendered.length,0);
});
test('41 Invalid native drawer geometry blocks normal MATERIAL and ROZRYS before rendering zero results',()=>{
 const r=fixture();drawers(r);seed(r,p=>p.room.cabinets[0].height=50);activate(r);assert.ok(r.list.textContent.includes('INVALID_DRAWER_FRONT_GEOMETRY'));assert.equal(r.list.querySelector('[data-part-options]'),null);
 for(const f of ['js/app/rozrys/rozrys-project-source.js','js/app/rozrys/rozrys.js'])load(r,f);const root=r.s.document.createElement('div');root.id='rozrysRoot';r.s.document.body.appendChild(root);assert.equal(r.FC.rozrys.render(),false);assert.equal(root.querySelectorAll('canvas').length,0);assert.ok(root.textContent.includes('INVALID_DRAWER_FRONT_GEOMETRY'));
});
test('42 Missing physical pointer blocks marked-project candidate persistence and calculation',async()=>{
 const r=fixture();activate(r);const candidate=r.FC.quoteSnapshot.buildSnapshot(await r.FC.wycenaCore.collectQuoteData());r.FC.projectStore.setCurrentProjectId('');
 assert.equal(r.policy.read().ok,false);assert.throws(()=>r.FC.quoteSnapshotStore.save(candidate),e=>e.projectPcv);await assert.rejects(r.FC.wycenaCore.collectQuoteData());assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
test('43 Changing edit room or physical project while modal is open refuses old draft',()=>{
 for(const context of ['room','project']){const r=fixture();activate(r);r.open();r.edge('w2',true);const before=r.row('A');
 if(context==='room')r.s.uiState.roomType='other';else{r.FC.investors.setCurrentId('inv-B');r.FC.projectStore.setCurrentProjectId('B');r.s.projectData=r.FC.project.load();}
 const afterTransition=r.row('A');assert.deepEqual(afterTransition.projectData,before.projectData);r.save();assert.ok(r.modal());assert.deepEqual(r.row('A'),afterTransition);assert.equal(r.row('B').projectData.room.production,undefined);}
});
test('44 Policy read, MATERIAL render and PCV editor opening have zero write/remove/begin',()=>{
 const r=fixture();activate(r);const before=r.rows(),ram=JSON.stringify(r.s.projectData);let begins=0;const begin=r.session.begin;r.session.begin=(...args)=>{begins++;return begin.apply(r.session,args);};r.storage.calls.length=0;
 assert.equal(r.policy.read().mode,'project');r.open();assert.equal(begins,0);assert.deepEqual(r.storage.calls,[]);assert.deepEqual(r.rows(),before);assert.equal(JSON.stringify(r.s.projectData),ram);
});
function switchToB(r){r.FC.investors.setCurrentId('inv-B');r.FC.projectStore.setCurrentProjectId('B');r.s.projectData=r.FC.project.load();}
test('45 A1 stale legacy candidate for marked A is refused by save, replace and writeAll while B is active',async()=>{
 for(const method of ['save','replace','writeAll']){
  const r=fixture(),candidate=await legacyCandidate(r);
  const historical=r.FC.quoteSnapshotStore.save(candidate);candidate.id='stale-new-'+method;
  activate(r);switchToB(r);const before=r.storage.getItem('fc_quote_snapshots_v1');
  assert.throws(()=>method==='save'?r.FC.quoteSnapshotStore.save(candidate):method==='replace'?r.FC.quoteSnapshotStore.replaceSnapshot(historical.id,candidate):r.FC.quoteSnapshotStore.writeAll([candidate]),e=>e.code==='PROJECT_PCV_QUOTE_PROOF_REQUIRED');
  assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),before);assert.equal(r.FC.projectStore.getCurrentProjectId(),'B');
 }
});
test('46 A1 historical metadata for marked A remains editable from B, but frozen data and owner cannot change',async()=>{
 const r=fixture(),saved=r.FC.quoteSnapshotStore.save(await legacyCandidate(r));activate(r);switchToB(r);
 const history=r.FC.quoteSnapshotStore.getById(saved.id),frozen=clone({lines:history.lines,totals:history.totals,scope:history.scope});
 history.commercial.versionName='Dozwolona nazwa';history.meta.versionName='Dozwolona nazwa';r.FC.quoteSnapshotStore.save(history);
 const edited=r.FC.quoteSnapshotStore.getById(saved.id);assert.equal(edited.commercial.versionName,'Dozwolona nazwa');assert.deepEqual(clone({lines:edited.lines,totals:edited.totals,scope:edited.scope}),frozen);
 for(const field of ['lines','totals','scope','investor']){
  const changed=clone(edited);if(field==='lines')changed.lines.materials[0].total+=1;else if(field==='totals')changed.totals.total+=1;else if(field==='scope')changed.scope.selectedRooms=['other'];else changed.investor={id:'inv-B'};
  const before=r.storage.getItem('fc_quote_snapshots_v1');assert.throws(()=>r.FC.quoteSnapshotStore.save(changed),e=>e.projectPcv);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),before);
 }
});
test('47 A1 target-owner validation works without policy and refuses ambiguous physical owners',async()=>{
 const r=fixture(),candidate=await legacyCandidate(r);activate(r);switchToB(r);delete r.FC.projectPcvPolicy;
 assert.throws(()=>r.FC.quoteSnapshotStore.save(candidate),e=>e.code==='PROJECT_PCV_QUOTE_PROOF_REQUIRED');
 const read=r.FC.projectStore.readAll;r.FC.projectStore.readAll=()=>{const rows=read();return rows.concat(rows.filter(row=>row.id==='A'));};
 assert.throws(()=>r.FC.quoteSnapshotStore.save(candidate),e=>e.code==='PROJECT_PCV_PROJECT_OWNER_AMBIGUOUS');
});
test('48 A2 missing policy blocks real MATERIAL and ordinary WYCENA, with no legacy writes or zero-priced offer',async()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.session.commit();delete r.FC.projectPcvPolicy;
 const before=r.rows();r.storage.calls.length=0;r.render();assert.ok(r.list.textContent.includes('PCV_POLICY_UNAVAILABLE'));assert.equal(r.list.querySelector('[data-part-options]'),null);
 assert.throws(()=>r.FC.materialTabData.collectRoomMaterials('room'),e=>e.code==='PROJECT_PCV_PCV_POLICY_UNAVAILABLE');await assert.rejects(r.FC.wycenaCore.collectQuoteData(),e=>e.code==='PROJECT_PCV_PCV_POLICY_UNAVAILABLE');
 const q=quotedUI(r);q.button.click();await tick();assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);
});
test('49 A2 missing policy stops normal ROZRYS before creating placements or touching cache',()=>{
 const r=fixture();activate(r);delete r.FC.projectPcvPolicy;
 for(const f of ['js/app/rozrys/rozrys-project-source.js','js/app/rozrys/rozrys.js'])load(r,f);
 const root=r.s.document.createElement('div');root.id='rozrysRoot';r.s.document.body.appendChild(root);r.storage.calls.length=0;
 assert.equal(r.FC.rozrys.render(),false);assert.ok(root.textContent.includes('PCV_POLICY_UNAVAILABLE'));assert.equal(root.querySelectorAll('canvas').length,0);assert.deepEqual(r.storage.calls,[]);
});
test('50 A2 stale PCV modal and direct global edge setter cannot write when policy disappears',()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);delete r.FC.projectPcvPolicy;const before=r.rows();r.save();assert.ok(r.modal());assert.equal(edgeInput(r.modal(),'1B').checked,true);assert.deepEqual(r.rows(),before);
 const edge=r.FC.materialEdgeStore.createEdgeStore(),part={name:'Bok',a:68.2,b:50,material:r.cab().bodyColor,qty:1};const sig=r.FC.materialPartOptions.signatureFromPart(part);
 assert.equal(edge.setEdges(sig,{w1:true}),false);assert.equal(r.storage.getItem('fc_edge_v1'),null);
});
test('51 A2 central-only marker, RAM-only marker, missing owner and failing storage are refused',()=>{
 for(const fault of ['central','ram','pointer','read']){
  const r=fixture();activate(r);delete r.FC.projectPcvPolicy;
  if(fault==='central')delete r.s.projectData.meta.productionPcvMode;
  if(fault==='ram')r.storage.rows.set('fc_projects_v1',JSON.stringify(r.FC.projectStore.readAll().map(row=>{if(row.id==='A')delete row.projectData.meta.productionPcvMode;return row;})));
  if(fault==='pointer')r.FC.projectStore.setCurrentProjectId('');
  if(fault==='read')r.FC.projectStore.readAll=()=>{throw Error('read failed');};
  assert.equal(r.FC.projectPcvGuard.read().ok,false);assert.throws(()=>r.FC.projectPcvGuard.calculationOptions(),e=>e.projectPcv);
 }
});
test('52 A2 broken policy API cannot select legacy and dependency errors preserve central data',async()=>{
 const r=fixture();activate(r);const before=r.rows();r.FC.projectPcvPolicy={};assert.equal(r.FC.projectPcvGuard.read().ok,false);await assert.rejects(r.FC.wycenaCore.collectQuoteData(),e=>e.projectPcv);assert.deepEqual(r.rows(),before);
});
test('53 Missing policy refuses automatic opening; isolated unmarked legacy adapter remains compatible',async()=>{
 const r=fixture();delete r.FC.projectPcvPolicy;const before=r.rows();assert.equal(openAutomatically(r),false);assert.deepEqual(r.rows(),before);
 const data=await r.FC.wycenaCore.collectQuoteData();const line=data.materialLines.find(l=>l.priceUnit==='mb');near(line.edgeRawMeters,16.44);near(line.qty,18.084);
});
test('54 A1 missing physical target, wrong investor and reparented historical offer cannot be persisted',async()=>{
 const r=fixture(),saved=r.FC.quoteSnapshotStore.save(await legacyCandidate(r));activate(r);
 for(const fault of ['missing','investor','reparent']){
  const candidate=r.FC.quoteSnapshotStore.getById(saved.id);if(fault!=='reparent')candidate.id='new-'+fault;
  if(fault==='missing')candidate.project.id='missing';else if(fault==='investor')candidate.investor={id:'inv-B'};else candidate.project.id='B';
  const before=r.storage.getItem('fc_quote_snapshots_v1');assert.throws(()=>r.FC.quoteSnapshotStore.save(candidate),e=>e.projectPcv);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),before);
 }
});
test('55 A2 incomplete policy result cannot downgrade a marked project or omit its calculation context',()=>{
 const r=fixture();activate(r);r.FC.projectPcvPolicy={read:()=>({ok:true,mode:'project',projectId:'A'})};
 assert.equal(r.FC.projectPcvGuard.read().ok,false);assert.throws(()=>r.FC.projectPcvGuard.calculationOptions(),e=>e.projectPcv);
});
test('56 A2 missing project store cannot hide a central marker behind an unmarked RAM copy',()=>{
 const r=fixture();activate(r);delete r.s.projectData.meta.productionPcvMode;delete r.FC.projectPcvPolicy;delete r.FC.projectStore;
 const before=r.rows();r.storage.calls.length=0;assert.equal(r.FC.projectPcvGuard.read().ok,false);assert.throws(()=>r.FC.projectPcvGuard.calculationOptions(),e=>e.projectPcv);assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);
});
test('57 B1 apparently valid legacy response cannot override RAM or central project marker',()=>{
 for(const source of ['both','ram','central']){
  const r=fixture();activate(r);
  if(source==='ram')r.storage.rows.set('fc_projects_v1',JSON.stringify(r.FC.projectStore.readAll().map(row=>{if(row.id==='A')delete row.projectData.meta.productionPcvMode;return row;})));
  if(source==='central')delete r.s.projectData.meta.productionPcvMode;
  r.FC.projectPcvPolicy={read:()=>({ok:true,mode:'legacy',options:{}})};
  const before=r.rows();r.storage.calls.length=0;assert.equal(r.FC.projectPcvGuard.read().ok,false);assert.throws(()=>r.FC.projectPcvGuard.calculationOptions(),e=>e.projectPcv);assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);
 }
});
test('58 B1 fake legacy policy stops ordinary MATERIAL, ROZRYS and WYCENA rather than showing legacy price',async()=>{
 const r=fixture();activate(r);r.open();r.edge('w2',true);r.save();r.session.commit();
 r.FC.projectPcvPolicy={read:()=>({ok:true,mode:'legacy',options:{}})};
 const before=r.rows();r.storage.calls.length=0;r.render();assert.equal(r.list.querySelector('[data-part-options]'),null);await assert.rejects(r.FC.wycenaCore.collectQuoteData(),e=>e.projectPcv);
 for(const f of ['js/app/rozrys/rozrys-project-source.js','js/app/rozrys/rozrys.js'])load(r,f);const root=r.s.document.createElement('div');root.id='rozrysRoot';r.s.document.body.appendChild(root);assert.equal(r.FC.rozrys.render(),false);assert.equal(root.querySelectorAll('canvas').length,0);
 const q=quotedUI(r);q.button.click();await tick();assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);
});
test('59 B2 missing project store refuses new legacy save, replace and writeAll without changing history',async()=>{
 for(const marked of [false,true])for(const method of ['save','replace','writeAll']){
  const r=fixture(),history=r.FC.quoteSnapshotStore.save(await legacyCandidate(r));
  const candidate=clone(history);candidate.id='unverified';candidate.lines.materials[0].total+=1;if(marked)activate(r);delete r.FC.projectStore;
  const before=r.storage.getItem('fc_quote_snapshots_v1');assert.throws(()=>method==='save'?r.FC.quoteSnapshotStore.save(candidate):method==='replace'?r.FC.quoteSnapshotStore.replaceSnapshot(history.id,candidate):r.FC.quoteSnapshotStore.writeAll([candidate]),e=>e.projectPcv);
  assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),before);assert.ok(r.FC.quoteSnapshotStore.getById(history.id));
 }
});
test('60 B2 missing project store preserves historical reads and allowed metadata, but not frozen-price edits',async()=>{
 const r=fixture(),saved=r.FC.quoteSnapshotStore.save(await legacyCandidate(r));activate(r);delete r.FC.projectStore;
 const history=r.FC.quoteSnapshotStore.getById(saved.id),before=clone({lines:history.lines,totals:history.totals,scope:history.scope});history.commercial.versionName='Historia bez store';history.meta.versionName='Historia bez store';r.FC.quoteSnapshotStore.save(history);
 const after=r.FC.quoteSnapshotStore.getById(saved.id);assert.equal(after.commercial.versionName,'Historia bez store');assert.deepEqual(clone({lines:after.lines,totals:after.totals,scope:after.scope}),before);
 const raw=r.storage.getItem('fc_quote_snapshots_v1');after.lines.materials[0].total+=1;assert.throws(()=>r.FC.quoteSnapshotStore.save(after),e=>e.projectPcv);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),raw);
});
if(require.main===module)(async()=>{let failures=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);process.exitCode=failures?1:0;})();

module.exports={fixture,activate,reopen,openAutomatically,load,protectedSeed,tick};
