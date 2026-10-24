'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const collect=require('../js/app/ui/session-diagnostics-readonly');
const uiSource=fs.readFileSync('js/app/ui/session-diagnostics.js','utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const units=rows=>[...rows].reduce((n,[key,value])=>n+key.length+value.length,0);
function fixture(extra={},payload=false){
  const owner={id:'PRIVATE_PROJECT',investorId:'PRIVATE_OWNER',projectData:{cabinets:[{id:'PRIVATE_CABINET',width:60}]}};
  const baseline=JSON.stringify([owner]);
  const snapshot={fc_projects_v1:baseline,fc_edge_v1:null,fc_material_part_options_v1:null};
  const context={projectId:owner.id,investorId:owner.investorId,roomId:''};
  const evidence={schemaVersion:4,active:true,projectId:owner.id,roomId:'',startedAt:1,updatedAt:1,context,snapshot,expectedOwnerKnown:true,expectedOwnerRaw:JSON.stringify(owner)};
  const session={...copy(evidence),durable:payload,lastError:{code:'SESSION_QUOTA_EXCEEDED'}};
  const ui={roomType:null,currentInvestorId:owner.investorId};
  const rows=new Map(Object.entries({fc_projects_v1:baseline,fc_current_project_id_v1:owner.id,fc_current_investor_v1:owner.investorId,fc_ui_v1:JSON.stringify(ui),...(payload?{fc_edit_session_v1:JSON.stringify(evidence)}:{}),...extra}));
  const state={valid:true,reads:0,writes:0,domain:0,network:0,hook:null,copies:[],capacity:Infinity};
  const event=(type,key)=>{state.reads++;if(state.hook)state.hook(type,key);};
  const storage={
    get length(){event('length');return rows.size;},key(i){event('key',i);return [...rows.keys()][i]??null;},
    getItem(key){event('get',key);return rows.get(key)??null;},
    setItem(key,value){state.writes++;const next=new Map(rows);next.set(key,String(value));if(units(next)>state.capacity)throw Object.assign(Error('PRIVATE_QUOTA'),{name:'QuotaExceededError'});throw Error('Forbidden write');},
    removeItem(){state.writes++;throw Error('Forbidden removal');},clear(){state.writes++;throw Error('Forbidden clear');},
  };
  for(const name of ['begin','commit','cancel','retryInitialBegin','canSaveProject'])session[name]=()=>{state.domain++;throw Error('Forbidden session method');};
  const messages=[],FC={session,sessionDiagnosticsReadonly:collect,infoBox:{open:opts=>messages.push(opts)},projectDomainOperations:{recoverProject(){state.domain++;throw Error('Forbidden recovery');}}};
  const navigator={clipboard:{async writeText(value){state.copies.push(value);}}};
  const w={location:{origin:'https://mebleszek.github.io',pathname:'/meble-app/'},localStorage:storage,FC,uiState:ui};
  Object.defineProperty(w,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>state.valid}),writable:false,configurable:false});
  for(const key of ['sessionStorage','indexedDB'])Object.defineProperty(w,key,{get(){state.writes++;throw Error('Forbidden store');}});
  const sandbox=vm.createContext({window:w,navigator,console,fetch(){state.network++;throw Error('No network');}});
  vm.runInContext(uiSource,sandbox);
  const snapshotState=()=>({raw:[...rows],session:JSON.stringify(session),ui:JSON.stringify(ui)});
  const read=(options={storageUsage:true})=>{
    const before=snapshotState(),report=collect(w,options);
    assert.equal(JSON.stringify(session),before.session);assert.equal(JSON.stringify(ui),before.ui);
    assert.equal(state.writes+state.domain+state.network,0);
    return report;
  };
  return {rows,state,storage,w,FC,session,navigator,messages,read,snapshotState};
}
const tests=[],test=(name,run)=>tests.push([name,run]);
test('known backups/cache and exact legacy session fields',()=>{
  const f=fixture({fc_data_backups_v1:'B'.repeat(3317250),fc_rozrys_plan_cache_v2:'C'.repeat(300000),fc_quote_snapshots_v1:'H'.repeat(1328079)},true),before=f.snapshotState();
  const legacy=f.read({}),report=f.read(),sizes=report.storageSizes;
  const stripped={...report};delete stripped.usage;delete stripped.ramActive;delete stripped.storageSizes;assert.deepEqual(stripped,legacy);
  assert.equal(legacy.CB,true);assert.equal(legacy.CE,true);assert.equal(legacy.ownerMatch,true);assert.equal(legacy.payloadShape,true);
  assert.equal(sizes.complete,true);assert.equal(sizes.kind,'meble-app-storage-sizes');assert.equal(sizes.status,'READ_ONLY');
  assert.equal(sizes.largest.key,'fc_data_backups_v1');assert.equal(sizes.largest.valueUnits,3317250);assert.equal(sizes.largest.category,'backups');
  assert.equal(sizes.top.find(row=>row.key==='fc_rozrys_plan_cache_v2').category,'cutting_cache');assert.equal(sizes.totalUnits,units(f.rows));assert.equal(sizes.totalUnits,report.usage.totalUnits);
  assert.equal(sizes.quotaLimitKnown,false);assert.deepEqual(f.snapshotState(),before);
});
test('unknown/dynamic keys and private values remain anonymous',()=>{
  for(const key of ['PRIVATE_CUSTOMER_TOKEN','fc_project_inv_PRIVATE_ID_v1','fc_project_inv_PRIVATE_ID_backup_v1','firebase:authUser:PRIVATE_TOKEN','fc_data_backups_v1_PRIVATE_ID']){
    const f=fixture({[key]:'PRIVATE_PRICE_SECRET'.repeat(100)}),before=f.snapshotState(),r=f.read();
    assert.equal(r.storageSizes.largest.key,'ANON_01');assert.equal(r.storageSizes.largest.recognized,false);assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.deepEqual(f.snapshotState(),before);
  }
});
test('full storage is observable without probing a write',()=>{
  const f=fixture({fc_rozrys_plan_cache_v2:'X'.repeat(3317250)});f.state.capacity=units(f.rows);
  assert.throws(()=>f.storage.setItem('probe','x'),{name:'QuotaExceededError'});f.state.writes=0;
  const before=f.snapshotState(),r=f.read();assert.equal(r.storageSizes.complete,true);assert.equal(r.storageSizes.largest.category,'cutting_cache');assert.deepEqual(f.snapshotState(),before);
});
test('read errors never return a complete or partial ranking',()=>{
  for(const mode of ['key','length','get']){
    const f=fixture({fc_data_backups_v1:'SECRET'}),before=f.snapshotState();f.state.hook=type=>{if(type===mode)throw Error('PRIVATE_EXCEPTION');};
    const r=f.read();assert.notEqual(r.status,'READ_ONLY');assert.equal(r.storageSizes,undefined);assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.deepEqual(f.snapshotState(),before);
  }
});
test('same-length changes and additions during the scan refuse',()=>{
  for(const mode of ['value','insert']){
    const f=fixture({fc_data_backups_v1:'BASE'});let count=0;
    f.state.hook=(type,key)=>{if(type==='get'&&key==='fc_data_backups_v1'&&++count===2){if(mode==='value')f.rows.set(key,'NEXT');else f.rows.set('PRIVATE_EXTERNAL','X');}};
    assert.equal(f.read().status,'DIAGNOSTIC_STATE_CHANGED');assert.equal(f.state.writes,0);
  }
});
test('Auth denial and revocation preserve all RAW and session state',()=>{
  const denied=fixture(),before=denied.snapshotState();denied.state.valid=false;assert.equal(denied.read().status,'AUTH_DENIED');assert.equal(denied.state.reads,0);assert.deepEqual(denied.snapshotState(),before);
  const f=fixture({fc_data_backups_v1:'X'}),prior=f.snapshotState();f.state.hook=(type,key)=>{if(type==='get'&&key==='fc_data_backups_v1')f.state.valid=false;};assert.equal(f.read().status,'AUTH_DENIED');assert.deepEqual(f.snapshotState(),prior);
  const duringNames=fixture();duringNames.state.hook=type=>{if(type==='key')duringNames.state.valid=false;};assert.equal(duringNames.read().status,'AUTH_DENIED');
});
test('bounded ranking, text scan and RAM serialization refuse excess work',()=>{
  const f=fixture(Object.fromEntries(Array.from({length:40},(_,i)=>['PRIVATE_'+i,'X'.repeat(1000+i)])));const r=f.read();assert.equal(r.storageSizes.top.length,10);assert.ok(r.storageSizes.top.every((row,i)=>i===0||row.valueUnits<=r.storageSizes.top[i-1].valueUnits));
  const large=fixture({fc_data_backups_v1:'X'.repeat(8*1024*1024)}),before=large.snapshotState(),l=large.read();assert.equal(l.usage.status,'TOO_LARGE');assert.equal(l.storageSizes.complete,false);assert.equal(l.storageSizes.top,undefined);assert.deepEqual(large.snapshotState(),before);
  const ram=fixture();ram.session.snapshot.private='X'.repeat(2*1024*1024);assert.equal(ram.read().status,'DIAGNOSTIC_TOO_LARGE');
  const nodes=fixture();nodes.session.snapshot.private=Array(100001).fill(null);assert.equal(nodes.read().status,'DIAGNOSTIC_TOO_LARGE');
  const many=fixture(Object.fromEntries(Array.from({length:2001},(_,i)=>['PRIVATE_'+i,''])));assert.equal(many.read().storageSizes.complete,false);
  const empty=fixture();empty.rows.clear();assert.equal(empty.read().storageSizes.largest,null);assert.deepEqual(empty.read().storageSizes.top,[]);
  const growing=fixture();let projectReads=0;
  growing.state.hook=(type,key)=>{if(type==='get'&&key==='fc_projects_v1'&&++projectReads===4)growing.session.snapshot.private='X'.repeat(2*1024*1024);};
  assert.equal(collect(growing.w,{storageUsage:true}).status,'DIAGNOSTIC_TOO_LARGE');assert.equal(growing.state.writes+growing.state.domain+growing.state.network,0);
});
test('C=B, C=E and conflicting current revision remain observations only',()=>{
  for(const mode of ['B','E','conflict']){
    const f=fixture({},true);
    if(mode!=='B'){
      const changed=JSON.parse(f.rows.get('fc_projects_v1'));changed[0].projectData.cabinets[0].width=70;
      if(mode==='E'){const p=JSON.parse(f.rows.get('fc_edit_session_v1'));p.expectedOwnerRaw=JSON.stringify(changed[0]);f.rows.set('fc_edit_session_v1',JSON.stringify(p));f.session.expectedOwnerRaw=p.expectedOwnerRaw;}
      f.rows.set('fc_projects_v1',JSON.stringify(changed));
    }
    const before=f.snapshotState(),r=f.read();assert.equal(r.CB,mode==='B');assert.equal(r.CE,mode!=='conflict');assert.deepEqual(f.snapshotState(),before);
  }
});
test('actual UI copy includes the entire anonymous report and preserves RAM/RAW',async()=>{
  const f=fixture({fc_data_backups_v1:'X'.repeat(1000),fc_rozrys_plan_cache_v2:'Y'.repeat(900)}),before=f.snapshotState();
  f.FC.sessionDiagnostics.open();const opts=f.messages.at(-1);assert.match(opts.message,/NAJWIĘKSZE MAGAZYNY PAMIĘCI/);assert.match(opts.message,/1\. fc_data_backups_v1/);assert.match(opts.message,/Pomiar: KOMPLETNY/);assert.match(opts.message,/Tryb: TYLKO ODCZYT/);assert.ok(!opts.message.includes('PRIVATE'));
  const body={textContent:''},button={disabled:false};await opts.secondaryAction.run({body,button});
  const copied=JSON.parse(f.state.copies[0]);assert.equal(copied.code,'SESSION_QUOTA_EXCEEDED');assert.equal(copied.present,false);assert.equal(copied.ram,true);assert.equal(copied.storageSizes.complete,true);assert.equal(copied.storageSizes.largest.key,'fc_data_backups_v1');assert.match(body.textContent,/Skopiowano raport/);assert.deepEqual(f.snapshotState(),before);
  f.state.valid=false;await opts.secondaryAction.run({body,button});assert.equal(f.state.copies.length,1);assert.equal(button.disabled,true);assert.match(body.textContent,/AUTH_DENIED/);assert.deepEqual(f.snapshotState(),before);
});
test('clipboard failure and incomplete scan remain explicit without fallback writes',async()=>{
  const f=fixture({fc_data_backups_v1:'X'.repeat(8*1024*1024)});f.FC.sessionDiagnostics.open();const opts=f.messages.at(-1);assert.match(opts.message,/Pomiar: NIEKOMPLETNY/);assert.doesNotMatch(opts.message,/Pomiar: KOMPLETNY/);
  f.navigator.clipboard=undefined;const body={textContent:''};await opts.secondaryAction.run({body,button:{}});assert.match(body.textContent,/Schowek niedostępny/);assert.equal(f.state.writes+f.state.domain+f.state.network,0);
});
(async()=>{for(const[name,run]of tests){await run();console.log('PASS '+name);}console.log('In-app session storage ranking: '+tests.length+' targeted groups PASS');})().catch(error=>{console.error(error.stack);process.exitCode=1;});
