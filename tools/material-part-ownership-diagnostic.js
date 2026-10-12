#!/usr/bin/env node
'use strict';
// Manual reproductions of OPEN C2.1b defects, deliberately outside *-smoke.js.
// Exit 0 means the recorded defect was reproduced, NOT that isolation is safe.
const assert=require('node:assert/strict');
const {fixture}=require('./material-grain-read-safety-smoke');
const cases=[];
const known=(name,fn)=>cases.push([name,fn]);
known('D1 identical cabinets/rooms share direction and PCV by signature',()=>{
  const r=fixture();r.s.materials=[{name:r.material,materialType:'laminat'}];
  const a=r.part('Bok',80,50,{cabinetId:'cab-one',roomId:'room'}),b=r.part('Bok',80,50,{cabinetId:'cab-two',roomId:'other'});
  const sig=r.FC.materialPartOptions.signatureFromPart(a);assert.equal(sig,r.FC.materialPartOptions.signatureFromPart(b));
  assert.equal(r.FC.materialPartOptions.setDirection(sig,'vertical'),true);assert.equal(r.FC.materialPartOptions.getDirection(r.FC.materialPartOptions.signatureFromPart(b)),'vertical');
  const edge=r.FC.materialEdgeStore.createEdgeStore();edge.getEdges(sig,a,{type:'stojąca'});assert.equal(edge.setEdges(sig,{w1:false}),true);
  assert.equal(r.FC.materialEdgeStore.createEdgeStore().getEdges(sig,b,{type:'stojąca'}).w1,false);
});
known('D2 identical parts in A and B inherit A global direction and rotation exception',()=>{
  const r=fixture(),a=r.part('Bok',80,50,{projectId:'A'}),b=r.part('Bok',80,50,{projectId:'B'}),sig=r.FC.materialPartOptions.signatureFromPart(a);
  assert.equal(r.FC.materialPartOptions.setDirection(sig,'vertical'),true);
  const rotationSig=r.sig(a);r.FC.rozrysGrain.setMaterialExceptions(r.material,{[rotationSig]:true},true);
  assert.equal(r.session.commit(),true);r.FC.investors.setCurrentId('inv-B');assert.equal(r.FC.projectStore.setCurrentProjectId('B'),'B');
  assert.equal(r.FC.materialPartOptions.getDirection(r.FC.materialPartOptions.signatureFromPart(b)),'vertical');assert.equal(r.read([b])[r.sig(b)],true);
});
known('D3 dimension changes detach overrides; the old global record remains orphaned',()=>{
  const r=fixture(),a=r.part(),sig=r.FC.materialPartOptions.signatureFromPart(a);
  assert.equal(r.FC.materialPartOptions.setDirection(sig,'vertical'),true);
  const resized=r.part('Bok',90,50);assert.notEqual(r.FC.materialPartOptions.signatureFromPart(resized),sig);
  assert.equal(r.FC.materialPartOptions.getDirection(r.FC.materialPartOptions.signatureFromPart(resized)),'default');
  assert.equal(JSON.parse(r.storage.getItem('fc_material_part_options_v1'))[sig],'vertical');
});
known('D4 explicit ROZRYS grain writes are not owned or rolled back by the room session',()=>{
  const r=fixture(),raw=r.seed({}),a=r.part();assert.equal(r.session.begin(),true);
  r.FC.rozrysGrain.setMaterialExceptions(r.material,{[r.sig(a)]:true},true);r.s.projectData.room.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);assert.equal(r.session.cancel(),true);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);assert.notEqual(r.storage.getItem('fc_rozrys_grain_state_v1'),raw);
});
known('D5 raw WYCENA engine path may allow rotation forbidden by the ROZRYS bridge',async()=>{
  const r=fixture(),a=r.part('Tall panel',190,260);r.seed({});const part=r.resolved(a);
  const state={material:r.material,unit:'cm',boardW:280,boardH:207,kerf:0.4,edgeTrim:1,grain:true,grainExceptions:{},heur:'max',direction:'start-optimax'};
  const drawing=r.bridge.computePlan(state,[part]),quote=await r.FC.wycenaCoreMaterialPlan.computePlanForMaterial(r.material,[part]);
  assert.equal(r.helpers.isPartRotationAllowed(part,true,{}),false);
  assert.equal(drawing.sheets.flatMap(sheet=>sheet.placements).length,0);
  const placements=quote.plan.sheets.flatMap(sheet=>sheet.placements);assert.equal(placements.length,1);assert.equal(placements[0].rotated,true);
});
known('D6 saving a scoped grain modal replaces exceptions outside its visible scope',()=>{
  const r=fixture(),a=r.part(),p=r.resolved(a);r.seed({foreign:true});
  const {makeMiniDocument}=require('./app-dev-smoke-lib/mini-document');r.s.document=makeMiniDocument();r.load('js/app/rozrys/rozrys-grain-modal.js');
  let panel;
  const h=(tag,attrs={})=>{const el=r.s.document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key==='text')el.textContent=value;else el.setAttribute(key,value);}return el;};
  r.FC.rozrysGrainModal.openMaterialGrainExceptions({material:r.material,parts:[p],h,unitValue:'mm'},{
    panelBox:{open:cfg=>{panel=cfg;},close(){}},materialHasGrain:()=>true,
    getMaterialGrainEnabled:r.FC.rozrysPrefs.getMaterialGrainEnabled,getMaterialGrainExceptions:r.FC.rozrysPrefs.getMaterialGrainExceptions,
    setMaterialGrainExceptions:r.FC.rozrysPrefs.setMaterialGrainExceptions,partSignature:r.FC.rozrysPrefs.partSignature,mmToUnitStr:String,
  });
  const cb=panel.contentNode.querySelector('input');cb.checked=true;cb.dispatchEvent({type:'change'});
  const save=[...panel.contentNode.querySelectorAll('button')].find(button=>button.textContent==='Zapisz');save.click();
  const exceptions=r.FC.rozrysGrain.getMaterialExceptions(r.material);assert.equal(exceptions.foreign,undefined);assert.equal(exceptions[r.sig(a)],true);
});
(async()=>{let reproduced=0;for(const [name,fn]of cases){try{await fn();reproduced++;console.log('OPEN DEFECT REPRODUCED: '+name);}catch(error){console.error('RECHECK REQUIRED: '+name+'\n'+error.stack);process.exitCode=1;}}console.log(`${reproduced}/${cases.length} open defects reproduced; not an acceptance test.`);})();
