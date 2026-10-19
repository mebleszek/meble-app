'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const BASE='0cb7044e5feec71d462354efc501dc9e4278cdb6';
if(process.argv.includes('--baseline')){const read=fs.readFileSync;fs.readFileSync=function(file,options){const name=String(file).replaceAll('\\','/');for(const f of ['js/app/investor/session.js','js/app/project/project-store.js'])if(name.endsWith(f)){const b=cp.execFileSync('git',['show',BASE+':'+f]);return options==='utf8'?b.toString():b;}return read.apply(this,arguments);};}
const {fixture}=require('./project-navigation-blockers-smoke');
const P='fc_projects_v1',E='fc_edit_session_v1',I='fc_current_project_id_v1';
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const make=()=>fixture(undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});
function quota(r,limit=5242880){const set=r.storage.setItem.bind(r.storage);r.storage.setItem=(k,v)=>{const next=new Map(r.storage.rows);next.set(k,String(v));if([...next].reduce((n,[a,b])=>n+a.length+b.length,0)>limit)throw new DOMException('synthetic quota','QuotaExceededError');return set(k,v);};}
function large(r){const rows=JSON.parse(r.storage.getItem(P));for(let i=0;i<5;i++)rows.push({...rows[1],id:'bulk'+i,investorId:'bulk-owner'+i,projectData:{room:{cabinets:[]},archive:'X'.repeat(700000)}});r.storage.rows.set(P,JSON.stringify(rows));}
function legacy(r){const rows=JSON.parse(r.storage.getItem(P));delete rows.find(x=>x.id==='P').projectData.meta.productionPcvMode;r.storage.rows.set(P,JSON.stringify(rows));r.s.projectData=r.FC.project.load();}
function protect(r){return Object.fromEntries([...r.storage.rows].filter(([k])=>![P,E,I,'fc_ui_v1','fc_project_backup_v1','fc_project_backup_meta_v1'].includes(k)));}
test('Large multi-investor store fits a lossless owner-only v4 session under quota',async()=>{
 const r=make();assert.equal(r.FC.projectPcvPolicy.ensureProjectMode().ok,true);large(r);quota(r);const before=r.storage.getItem(P),other=protect(r);
 assert.equal(await r.open(),true);assert.equal(r.FC.session.durable,true);assert.equal(r.storage.getItem(P),before);
 const p=JSON.parse(r.storage.getItem(E));assert.equal(p.schemaVersion,4);assert.equal(JSON.parse(p.snapshot[P]).length,1);assert.deepEqual(JSON.parse(p.snapshot[P])[0],JSON.parse(before).find(x=>x.id==='P'));assert.ok(r.storage.getItem(E).length<before.length/100);assert.deepEqual(protect(r),other);
 console.log('MEASURE',JSON.stringify({projectsUnits:before.length,payloadUnits:r.storage.getItem(E).length}));
 const seed=r.seed(),fresh=fixture(seed,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});assert.equal(fresh.FC.session.canSaveProject(),true);assert.equal(fresh.FC.session.commit(),true);assert.equal(fresh.storage.getItem(P),before);
});
test('Failed legacy PCV write and unchanged pointer do not poison a sessionless retry',()=>{
 const r=make();legacy(r);const before=r.seed();r.storage.fail.set(P,true);r.storage.fail.set(I,true);assert.equal(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('K'),false);assert.equal(r.storage.getItem(P),before[P]);assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem(E),null);assert.equal(r.FC.session.canSaveProject(),true);
 r.storage.fail.clear();assert.equal(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('K'),true);assert.equal(r.FC.session.canSaveProject(),true);assert.equal(r.record().projectData.meta.productionPcvMode,'project');
});
test('Already-marked investor activation never writes an unchanged project pointer',()=>{
 const r=make();assert.equal(r.FC.projectPcvPolicy.ensureProjectMode().ok,true);r.storage.fail.set(I,true);r.storage.calls.length=0;const before=r.storage.getItem(P);
 assert.equal(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('K'),true);assert.equal(r.storage.calls.includes(I),false);assert.equal(r.storage.getItem(P),before);assert.equal(r.FC.session.canSaveProject(),true);
});
for(const mode of ['denied','quota','noop','false','readback'])test('Begin remains protected with real '+mode+' failure and no project write',()=>{
 const r=make();assert.equal(r.FC.projectPcvPolicy.ensureProjectMode().ok,true);r.s.uiState.roomType='room_k';const before=r.seed(),set=r.storage.setItem.bind(r.storage),get=r.storage.getItem.bind(r.storage);let wrote=false;
 r.storage.setItem=(k,v)=>{if(k!==E)return set(k,v);if(mode==='denied')throw new DOMException('synthetic denied','SecurityError');if(mode==='quota')throw new DOMException('synthetic quota','QuotaExceededError');if(mode==='noop')return;if(mode==='false')return false;wrote=true;return set(k,v);};
 if(mode==='readback')r.storage.getItem=k=>k===E&&wrote?'{}':get(k);
 assert.equal(r.FC.session.begin('room_k'),false);assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,false);assert.equal(r.storage.getItem(P),before[P]);assert.equal(r.FC.session.canSaveProject(),false);assert.equal(r.FC.session.lastError.code,'SESSION_UNCONFIRMED');assert.deepEqual(protect(r),Object.fromEntries(Object.entries(before).filter(([k])=>![P,E,I,'fc_ui_v1','fc_project_backup_v1','fc_project_backup_meta_v1'].includes(k))));
});
test('Oversized owner still refuses; no deletion or global trimming',()=>{
 const r=make();assert.equal(r.FC.projectPcvPolicy.ensureProjectMode().ok,true);const rows=JSON.parse(r.storage.getItem(P));rows.find(x=>x.id==='P').projectData.archive='X'.repeat(3000000);r.storage.rows.set(P,JSON.stringify(rows));quota(r);const before=r.seed();assert.equal(r.FC.session.begin('room_k'),false);assert.equal(r.FC.session.durable,false);assert.deepEqual(r.seed(),before);
});
test('Confirmed edit/cancel preserves all other projects and rooms, including unknown fields',async()=>{
 const r=make();large(r);const other=protect(r);assert.equal(await r.open(),true);const initial=r.record().projectData.room_k.cabinets[0].width;r.s.projectData.room_k.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);const before=JSON.parse(r.storage.getItem(P));assert.equal(r.FC.session.cancel(),true);const after=JSON.parse(r.storage.getItem(P));assert.equal(after.find(x=>x.id==='P').projectData.room_k.cabinets[0].width,initial);assert.deepEqual(after.filter(x=>x.id!=='P'),before.filter(x=>x.id!=='P'));assert.deepEqual(protect(r),other);
});
test('Legacy full-store v4 payload survives restart and scoped Cancel unchanged',async()=>{
 const r=make();await r.open();const p=JSON.parse(r.storage.getItem(E));p.snapshot[P]=r.storage.getItem(P);r.storage.rows.set(E,JSON.stringify(p));const fresh=fixture(r.seed(),{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});assert.equal(fresh.FC.session.canSaveProject(),true);const before=fresh.storage.getItem(P);assert.equal(fresh.FC.session.cancel(),true);assert.equal(fresh.storage.getItem(P),before);
});
test('A genuine external revision remains blocked after restart',async()=>{
 const r=make();await r.open();const rows=JSON.parse(r.storage.getItem(P));rows.find(x=>x.id==='P').projectData.room_k.cabinets[0].width=99;r.storage.rows.set(P,JSON.stringify(rows));const fresh=fixture(r.seed(),{timers:{setTimeout:()=>0,clearTimeout:()=>{}}}),before=fresh.seed();assert.equal(fresh.FC.session.canSaveProject(),false);assert.equal(fresh.FC.session.lastError.code,'PROJECT_WRITE_CONFLICT');assert.equal(fresh.FC.session.cancel(),false);assert.deepEqual(fresh.seed(),before);
});
test('A failed switch to a different project cannot adopt that project',()=>{
 const r=make(),before=r.seed();r.storage.fail.set(I,true);assert.equal(r.FC.projectStore.setCurrentProjectId('Q'),false);assert.equal(r.FC.projectStore.getCurrentProjectId(),'P');assert.equal(r.storage.getItem(P),before[P]);assert.equal(r.FC.session.active,false);
});
test('Partial project success with lost session acknowledgement remains blocked after restart',async()=>{
 const r=make();await r.open();r.storage.fail.set(E,true);r.s.projectData.room_k.cabinets[0].width=77;const result=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.equal(r.FC.session.canSaveProject(),false);const fresh=fixture(r.seed(),{timers:{setTimeout:()=>0,clearTimeout:()=>{}}}),before=fresh.seed();assert.equal(fresh.FC.session.canSaveProject(),false);assert.equal(fresh.FC.session.cancel(),false);assert.deepEqual(fresh.seed(),before);
});
test('Serialization failure keeps the original RAM evidence and all stored bytes',()=>{
 const r=make();assert.equal(r.FC.projectPcvPolicy.ensureProjectMode().ok,true);r.s.uiState.roomType='room_k';r.storage.fail.set(E,true);assert.equal(r.FC.session.begin('room_k'),false);r.storage.fail.clear();const before=r.seed(),snapshot=r.FC.session.snapshot;r.FC.session.context.circular=r.FC.session.context;assert.equal(r.FC.session.begin('room_k'),false);assert.equal(r.FC.session.lastError.code,'SESSION_SERIALIZATION_FAILED');assert.equal(r.FC.session.snapshot,snapshot);assert.deepEqual(r.seed(),before);
});
test('A failed project write with an established session does not become a partial success',async()=>{
 const r=make();await r.open();const before=r.storage.getItem(P),payload=r.storage.getItem(E);r.storage.fail.set(P,true);r.s.projectData.room_k.cabinets[0].width=66;const result=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(result.ok,false);assert.notEqual(result.projectSaved,true);assert.equal(r.storage.getItem(P),before);assert.equal(r.storage.getItem(E),payload);assert.equal(r.FC.session.canSaveProject(),true);
});
test('A genuinely failed rollback of a changed pointer remains blocked without a session',()=>{
 const r=make();r.storage.rows.set('fc_current_investor_v1','N');r.storage.fail.set(P,true);const set=r.storage.setItem.bind(r.storage);r.storage.setItem=(k,v)=>{if(k===I&&v==='P')throw Error('failed pointer rollback');return set(k,v);};const before=r.storage.getItem(P);assert.equal(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('N'),false);assert.equal(r.storage.getItem(I),'Q');assert.equal(r.storage.getItem(P),before);assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem(E),null);assert.equal(r.FC.session.canSaveProject(),false);assert.equal(r.FC.session.lastError.code,'SESSION_UNCONFIRMED');
});
(async()=>{let failed=0;for(const[n,fn]of tests){try{await fn();console.log('PASS '+n);}catch(e){failed++;console.error('FAIL '+n+'\n'+e.stack);}}console.log(`Storage pressure: ${tests.length-failed}/${tests.length} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;})();
