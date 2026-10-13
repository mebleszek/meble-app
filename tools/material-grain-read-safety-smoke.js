#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {runtime}=require('./project-session-owner-rollback-smoke');
const root=path.resolve(__dirname,'..'),G='fc_rozrys_grain_state_v1';
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
  const r=runtime(),s=r.s,FC=r.FC;s.document={getElementById:()=>null};s.uiState={roomType:'room',activeTab:'wywiad',currentInvestorId:'inv-A'};
  r.load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s,{filename:file});
  for(const file of ['js/app/material/material-part-options.js','js/app/material/material-edge-store.js','js/app/rozrys/rozrys-grain.js','js/app/rozrys/rozrys-prefs.js',
    'js/app/rozrys/rozrys-part-helpers.js','js/app/rozrys/rozrys-scope.js','js/app/shared/room-scope-resolver.js','js/app/optimizer/cut-optimizer.js',
    'js/app/rozrys/rozrys-engine.js','js/app/rozrys/rozrys-engine-bridge.js'])r.load(file);
  FC.wycenaCoreUtils={clone};FC.wycenaCoreCatalog={};FC.wycenaCoreSource={};FC.wycenaCoreSelection={};FC.materialHasGrain=()=>true;
  r.load('js/app/wycena/wycena-core-material-plan.js');
  r.material='Egger Oak';r.part=(name='Bok',a=80,b=50,extra={})=>({name,a,b,qty:1,material:r.material,...extra});
  r.resolved=p=>({...FC.materialPartOptions.resolvePartForRozrys(p),material:r.material});
  r.sig=p=>FC.rozrysPrefs.partSignature(r.resolved(p));
  r.seed=exceptions=>{const raw=JSON.stringify({[r.material]:{enabled:true,exceptions},'Other material':{enabled:false,exceptions:{other:true}}},null,2);r.storage.setItem(G,raw);r.storage.calls.length=0;return raw;};
  r.read=parts=>FC.rozrysPrefs.getMaterialGrainExceptions(r.material,parts.map(r.sig),true);
  r.noWrites=raw=>{assert.equal(r.storage.getItem(G),raw);assert.deepEqual(r.storage.calls,[]);};
  r.helpers=FC.rozrysPartHelpers.createApi({FC,host:s,cmToMm:v=>Math.round(v*10),partSignature:FC.rozrysPrefs.partSignature});
  r.bridge=FC.rozrysEngineBridge.createApi({FC,loadEdgeStore:FC.rozrysPrefs.loadEdgeStore,partSignature:FC.rozrysPrefs.partSignature,isPartRotationAllowed:r.helpers.isPartRotationAllowed});
  return r;
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('Active exceptions retain boolean semantics without touching RAW or enabled state',()=>{
  const r=fixture(),a=r.part(),b=r.part('Półka'),raw=r.seed({[r.sig(a)]:1,[r.sig(b)]:0,foreign:true});
  assert.deepEqual(clone(r.read([a,b])),{[r.sig(a)]:true,[r.sig(b)]:false});r.noWrites(raw);assert.equal(r.FC.session.active,false);
});
test('Empty selection and missing material never erase or initialize storage',()=>{
  const r=fixture(),raw=r.seed({retained:true});assert.deepEqual(clone(r.read([])),{});r.noWrites(raw);
  r.storage.rows.delete(G);assert.deepEqual(clone(r.read([r.part()])),{});r.noWrites(null);
});
test('Malformed legacy JSON is not replaced during exception reads',()=>{
  const r=fixture(),raw='{ damaged legacy RAW';r.storage.setItem(G,raw);r.storage.calls.length=0;
  assert.deepEqual(clone(r.read([r.part()])),{});r.noWrites(raw);
});
test('Returned map is detached, including a store supplying a shared RAM object',()=>{
  const r=fixture(),shared={a:true,b:false};let prunes=0;
  r.FC.rozrysGrain={getMaterialExceptions:()=>shared,pruneMaterialExceptions(){prunes++;throw Error('Mutating API must not be called');}};
  const filtered=r.FC.rozrysPrefs.getMaterialGrainExceptions('x',['a'],true);filtered.a=false;
  const all=r.FC.rozrysPrefs.getMaterialGrainExceptions('x');all.b=true;assert.deepEqual(shared,{a:true,b:false});assert.equal(prunes,0);
});
test('Two identical cabinet parts can be read without deleting inactive exceptions',()=>{
  const r=fixture(),a=r.part('Bok',80,50,{cabinetId:'one'}),b=r.part('Bok',80,50,{cabinetId:'two'}),raw=r.seed({[r.sig(a)]:true,outside:true});
  assert.equal(r.read([a,b])[r.sig(a)],true);r.noWrites(raw);
  // Ownership collisions are reproduced separately; this assertion only protects reads.
});
test('Dimension change and return filter active keys but preserve the old exception',()=>{
  const r=fixture(),a=r.part(),changed=r.part('Bok',90,50),raw=r.seed({[r.sig(a)]:true});
  assert.deepEqual(clone(r.read([changed])),{});r.noWrites(raw);assert.equal(r.read([a])[r.sig(a)],true);r.noWrites(raw);
});
test('Real room aggregation A → B → A+B → A never prunes other rooms',()=>{
  const r=fixture(),a=r.part(),b=r.part('Półka'),raw=r.seed({[r.sig(a)]:true,[r.sig(b)]:false,foreign:true});
  const data={kitchen:{cabinets:[{id:'one',parts:[a]},{id:'two',parts:[a]}]},living:{cabinets:[{id:'three',parts:[b]}]}};
  const deps={safeGetProject:()=>data,getRooms:()=>['kitchen','living'],getCabinetCutList:c=>c.parts,resolveRozrysPartFromSource:r.FC.materialPartOptions.resolvePartForRozrys};
  for(const rooms of [['kitchen'],['living'],['kitchen','living'],['kitchen']]){
    const aggregate=r.FC.rozrysScope.aggregatePartsForProject(rooms,deps),parts=aggregate.groups[r.material].allParts;
    const allowed=parts.map(r.FC.rozrysPrefs.partSignature),active=r.FC.rozrysPrefs.getMaterialGrainExceptions(r.material,allowed,true);
    assert.deepEqual(Object.keys(active).sort(),[...new Set(allowed)].sort());r.noWrites(raw);
  }
});
test('Switching physical projects and back preserves the complete global RAW',()=>{
  const r=fixture(),a=r.part(),b=r.part('Front'),raw=r.seed({[r.sig(a)]:true,[r.sig(b)]:true});
  r.read([a]);r.FC.investors.setCurrentId('inv-B');assert.equal(r.FC.projectStore.setCurrentProjectId('B'),'B');r.s.projectData=r.FC.project.load();r.read([b]);
  r.FC.investors.setCurrentId('inv-A');assert.equal(r.FC.projectStore.setCurrentProjectId('A'),'A');r.s.projectData=r.FC.project.load();assert.equal(r.read([a])[r.sig(a)],true);
  assert.equal(r.storage.getItem(G),raw);assert.ok(!r.storage.calls.some(c=>c[1]===G));
});
test('Reads during real room rollback preserve global data and the other project',()=>{
  const r=fixture(),a=r.part(),raw=r.seed({[r.sig(a)]:true,foreign:true}),other=clone(r.row('B'));
  assert.equal(r.session.begin(),true);r.read([r.part('Bok',90,50)]);r.s.projectData.room.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);assert.equal(r.session.cancel(),true);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);assert.deepEqual(r.row('B'),other);
  assert.equal(r.storage.getItem(G),raw);assert.ok(!r.storage.calls.some(c=>c[1]===G));
});
test('ROZRYS and WYCENA share active rotation policy and agree when rotation is allowed',async()=>{
  const r=fixture(),a=r.part('Tall panel',190,260),raw=r.seed({[r.sig(a)]:true,foreign:true}),p=r.resolved(a),FC=r.FC;
  const exceptions=r.read([a]);
  for(const grain of [true,false])for(const ignore of [true,false]){
    const part={...p,ignoreGrain:ignore};assert.equal(r.helpers.isPartRotationAllowed(part,grain,exceptions),FC.wycenaCoreMaterialPlan.isPartRotationAllowed(part,grain,exceptions));
  }
  const state={material:r.material,unit:'cm',boardW:280,boardH:207,kerf:0.4,edgeTrim:1,grain:true,grainExceptions:exceptions,heur:'max',direction:'start-optimax'};
  const drawing=r.bridge.computePlan(state,[p]),quote=await FC.wycenaCoreMaterialPlan.computePlanForMaterial(r.material,[p]);
  assert.equal(drawing.sheets.length,1);assert.equal(quote.plan.sheets.length,drawing.sheets.length);
  const drawingPlaced=drawing.sheets.flatMap(sheet=>sheet.placements),quotePlaced=quote.plan.sheets.flatMap(sheet=>sheet.placements);
  assert.equal(drawingPlaced.length,1);assert.equal(quotePlaced.length,1);
  assert.deepEqual(clone(drawingPlaced.map(p=>[p.w,p.h,p.rotated])),clone(quotePlaced.map(p=>[p.w,p.h,p.rotated])));r.noWrites(raw);
});
async function main(){let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;}
if(require.main===module)main();
module.exports={fixture};
