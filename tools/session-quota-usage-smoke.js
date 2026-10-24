'use strict';
const assert=require('node:assert/strict');
const {fixture}=require('./project-navigation-blockers-smoke');
const collect=require('../js/app/ui/session-diagnostics-readonly');
const P='fc_projects_v1',E='fc_edit_session_v1';
const tests=[],test=(name,run)=>tests.push([name,run]);
function make(seed){
  const r=fixture(seed,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});
  r.s.location={origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html'};
  let allowed=true;r.deny=()=>{allowed=false;};
  Object.defineProperty(r.s,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>allowed}),writable:false,configurable:false});
  if(!seed){assert.equal(r.FC.projectPcvPolicy.ensureProjectMode().ok,true);r.s.projectData=r.FC.project.load();r.s.uiState.roomType='room_k';}
  return r;
}
const units=rows=>[...rows].reduce((n,[k,v])=>n+k.length+v.length,0);
function budget(r,extra,peak=false){
  const meter={limit:units(r.storage.rows)+extra,failures:0},set=r.storage.setItem.bind(r.storage);
  r.storage.setItem=(key,value)=>{
    const next=new Map(r.storage.rows);next.set(key,String(value));
    const cost=peak&&key===E&&r.storage.rows.has(E)?units(r.storage.rows)+key.length+String(value).length:units(next);
    if(cost>meter.limit){meter.failures++;throw new DOMException('Synthetic byte budget exceeded','QuotaExceededError');}
    return set(key,value);
  };
  return meter;
}
function observe(r){
  const before=r.seed(),state=JSON.stringify(r.FC.session),calls=r.storage.calls.length;
  const report=collect(r.s,{storageUsage:true});
  assert.deepEqual(r.seed(),before);assert.equal(JSON.stringify(r.FC.session),state);assert.equal(r.storage.calls.length,calls);
  assert.ok(!JSON.stringify(report).includes('PRIVATE_SENTINEL'));
  return report;
}
test('Anonymous footprint covers every category, many projects and a large record without probes',()=>{
  const r=make(),rows=JSON.parse(r.storage.getItem(P));
  for(let i=0;i<5;i++)rows.push({...rows[1],id:'PRIVATE_SENTINEL-'+i,projectData:{archive:'X'.repeat(70000)}});
  rows[1].projectData.archive='Y'.repeat(300000);r.storage.rows.set(P,JSON.stringify(rows));
  for(const key of ['fc_quote_snapshots_v1','fc_project_backup_v1','fc_quote_rates_v1','PRIVATE_SENTINEL_UNKNOWN_KEY'])r.storage.rows.set(key,JSON.stringify({private:'PRIVATE_SENTINEL'}));
  assert.equal(r.FC.session.begin('room_k'),true);
  const out=observe(r),u=out.usage;
  assert.equal(out.status,'READ_ONLY');assert.equal(u.status,'MEASURED');assert.equal(u.totalUnits,units(r.storage.rows));
  assert.equal(Object.values(u.categories).reduce((n,g)=>n+g.units,0),u.totalUnits);
  for(const name of ['session','projects','investors','catalogs','history','backups','other'])assert.ok(u.categories[name].units>0,name);
  assert.equal(u.projectCount,7);assert.ok(u.largestProjectUnits>300000);
  const baseline=JSON.parse(r.FC.session.snapshot[P]);assert.equal(baseline.length,1);assert.deepEqual(baseline[0],rows.find(row=>row.id==='P'));
  assert.ok(r.FC.session.snapshot[P].length<r.storage.getItem(P).length);
  assert.equal(u.quotaLimitKnown,false);assert.equal(u.transientWriteCostKnown,false);
});
test('Full aggregate store rejects first begin; unchanged proven baseline alone permits retry',()=>{
  const r=make();r.storage.rows.set('fc_project_backup_v1','B'.repeat(60000));r.storage.rows.set('fc_quote_snapshots_v1','H'.repeat(40000));
  const meter=budget(r,1),before=r.seed();
  assert.equal(r.FC.session.begin('room_k'),false);assert.equal(meter.failures,1);assert.equal(r.FC.session.lastError.code,'SESSION_QUOTA_EXCEEDED');assert.deepEqual(r.seed(),before);
  const snapshot=r.FC.session.snapshot,baseline=r.FC.session.expectedOwnerRaw,report=observe(r);
  assert.equal(report.present,false);assert.equal(report.ramActive,true);assert.equal(report.usage.sessionPayloadUnits,0);assert.ok(report.usage.ramPayloadUnitsEstimate>0);
  meter.limit=Infinity;assert.equal(r.FC.session.retryInitialBegin(),true);
  assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.FC.session.expectedOwnerRaw,baseline);assert.equal(r.storage.getItem(P),before[P]);
  for(const [key,value]of Object.entries(before))if(key!==E)assert.equal(r.storage.getItem(key),value,key);
  const fresh=make(r.seed());assert.equal(fresh.FC.session.canSaveProject('room_k'),true);assert.equal(observe(fresh).CB,true);
});
test('A large single owner still refuses and retains every RAW, including after document restart',()=>{
  const r=make(),rows=JSON.parse(r.storage.getItem(P));rows.find(row=>row.id==='P').projectData.room_k.archive='Z'.repeat(300000);r.storage.rows.set(P,JSON.stringify(rows));
  const before=r.seed();budget(r,1000);assert.equal(r.FC.session.begin('room_k'),false);assert.deepEqual(r.seed(),before);
  const out=observe(r);assert.ok(out.usage.currentProjectUnits>300000);assert.ok(out.usage.ramPayloadUnitsEstimate>out.usage.currentProjectUnits);
  const fresh=make(r.seed()),freshBefore=fresh.seed();assert.equal(fresh.FC.session.retryInitialBegin(),true); // Existing sessionless no-op, never a recovered proof.
  assert.deepEqual(fresh.seed(),freshBefore);assert.equal(fresh.FC.session.active,false);assert.equal(fresh.storage.getItem(E),null);
});
test('Retry refuses an external revision even when quota is no longer present',()=>{
  const r=make(),meter=budget(r,1);assert.equal(r.FC.session.begin('room_k'),false);
  const rows=JSON.parse(r.storage.getItem(P));rows.find(row=>row.id==='P').projectData.room_k.cabinets[0].width=99;r.storage.rows.set(P,JSON.stringify(rows));
  meter.limit=Infinity;const before=r.seed();assert.equal(r.FC.session.retryInitialBegin(),false);assert.deepEqual(r.seed(),before);
});
test('Replacement may need transient capacity; lost acknowledgement never adopts the newer revision',()=>{
  const r=make();assert.equal(r.FC.session.begin('room_k'),true);
  const size=r.storage.getItem(E).length,meter=budget(r,Math.floor(size/2),true);
  r.s.projectData.room_k.cabinets[0].width=65;
  const result=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.ok(meter.failures>0);
  const fresh=make(r.seed()),before=fresh.seed();assert.equal(fresh.FC.session.canSaveProject('room_k'),false);assert.equal(fresh.FC.session.cancel(),false);
  const out=observe(fresh);assert.equal(out.CB,false);assert.equal(out.CE,false);assert.deepEqual(fresh.seed(),before);
});
test('C=B, C=E and C different from B/E remain observations; Cancel preserves other projects',()=>{
  for(const mode of ['B','E','foreign']){
    const r=make();assert.equal(r.FC.session.begin('room_k'),true);
    if(mode!=='B'){r.s.projectData.room_k.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);}
    if(mode==='foreign'){const rows=JSON.parse(r.storage.getItem(P));rows.find(row=>row.id==='P').projectData.room_k.cabinets[0].width=99;r.storage.rows.set(P,JSON.stringify(rows));}
    const fresh=make(r.seed()),before=fresh.seed(),out=observe(fresh);assert.equal(out.CB,mode==='B');assert.equal(out.CE,mode!=='foreign');
    if(mode==='foreign'){assert.equal(fresh.FC.session.cancel(),false);assert.deepEqual(fresh.seed(),before);}
    else{
      assert.equal(fresh.FC.session.cancel(),true);
      const after=JSON.parse(fresh.storage.getItem(P)),prior=JSON.parse(before[P]);assert.deepEqual(after.filter(row=>row.id!=='P'),prior.filter(row=>row.id!=='P'));
      for(const [key,value]of Object.entries(before))if(![P,E,'fc_project_backup_v1','fc_project_backup_meta_v1'].includes(key))assert.equal(fresh.storage.getItem(key),value,key);
    }
  }
});
test('Auth refusal reads no storage, changing data refuses, and no storage estimate is consulted',()=>{
  const r=make();Object.defineProperty(r.s,'navigator',{get(){throw Error('navigator must not be consulted');}});
  const before=r.seed(),get=r.storage.getItem.bind(r.storage);let reads=0;r.storage.getItem=key=>{reads++;return get(key);};r.deny();
  assert.deepEqual(collect(r.s,{storageUsage:true}),{v:1,status:'AUTH_DENIED'});assert.equal(reads,0);assert.deepEqual(r.seed(),before);
  const other=make();const original=other.storage.getItem.bind(other.storage);let count=0;
  other.storage.rows.set('PRIVATE_SENTINEL_UNKNOWN_KEY','before');
  other.storage.getItem=key=>{if(key==='PRIVATE_SENTINEL_UNKNOWN_KEY'&&++count===2)other.storage.rows.set(key,'external');return original(key);};
  assert.equal(collect(other.s,{storageUsage:true}).status,'DIAGNOSTIC_STATE_CHANGED');assert.equal(other.storage.rows.get('PRIVATE_SENTINEL_UNKNOWN_KEY'),'external');
  const expired=make(),read=expired.storage.getItem.bind(expired.storage);let countReads=0;
  expired.storage.rows.set('PRIVATE_SENTINEL_EXPIRY','data');
  expired.storage.getItem=key=>{countReads++;if(key==='PRIVATE_SENTINEL_EXPIRY')expired.deny();return read(key);};
  assert.deepEqual(collect(expired.s,{storageUsage:true}),{v:1,status:'AUTH_DENIED'});assert.ok(countReads>7,'Lease expired during the additional read-only scan');
});
async function main(){for(const [name,run]of tests){await run();console.log('PASS '+name);}console.log(`Session quota usage: ${tests.length}/${tests.length} PASS`);}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
