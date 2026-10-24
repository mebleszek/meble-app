'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'diagnostics/pixel-storage-sizes-readonly.js'),'utf8');
const units=rows=>Array.from(rows,([key,value])=>key.length+value.length).reduce((a,b)=>a+b,0);
function fixture(seed={}){
  const rows=new Map(Object.entries(seed));
  const state={authorized:true,reads:0,writes:0,hook:null,capacity:Infinity};
  const event=(type,key)=>{state.reads++;if(state.hook)state.hook(type,key);};
  const storage={
    get length(){event('length');return rows.size;},
    key(i){event('key',i);return Array.from(rows.keys())[i]??null;},
    getItem(key){event('get',key);return rows.has(key)?rows.get(key):null;},
    setItem(key,value){
      state.writes++;
      const next=new Map(rows);next.set(String(key),String(value));
      if(units(next)>state.capacity)throw Object.assign(Error('PRIVATE_QUOTA_ERROR'),{name:'QuotaExceededError'});
      throw Error('Any write is forbidden in this diagnostic fixture');
    },
    removeItem(){state.writes++;throw Error('remove forbidden');},
    clear(){state.writes++;throw Error('clear forbidden');},
  };
  const appRam={session:{active:true,durable:false,snapshot:{private:'PRIVATE_RAM_SENTINEL'}},form:{draft:'PRIVATE_UNSAVED_FORM'}};
  const w={location:Object.freeze({origin:'https://mebleszek.github.io',pathname:'/meble-app/'})};
  Object.defineProperty(w,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>state.authorized}),writable:false,configurable:false});
  Object.defineProperty(w,'localStorage',{get(){event('storage');return storage;}});
  for(const key of ['FC','projectData','uiState','document','navigator','sessionStorage','indexedDB','fetch','XMLHttpRequest','WebSocket','setTimeout','alert','locationAssign']){
    Object.defineProperty(w,key,{get(){throw Error('Forbidden application or side-effect API: '+key);}});
  }
  const context=vm.createContext({window:w});
  const snapshot=()=>Array.from(rows);
  const run=()=>{
    const globalKeys=Object.keys(context),ram=JSON.stringify(appRam);
    const report=JSON.parse(vm.runInContext(source,context,{timeout:3000}));
    assert.deepEqual(Object.keys(context),globalKeys,'No application or VM globals added');
    assert.equal(JSON.stringify(appRam),ram,'No change to session/form RAM');
    assert.equal(state.writes,0,'No storage mutation attempted');
    return report;
  };
  return {rows,state,storage,w,run,snapshot};
}
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function refused(report,status){
  assert.equal(report.status,status);assert.equal(report.complete,false);
  assert.deepEqual(Object.keys(report).sort(),['complete','kind','status','v']);
}
test('known largest store: exact units, ten largest, correct category and unchanged RAW',()=>{
  const seed={fc_data_backups_v1:'B'.repeat(3317250),fc_quote_snapshots_v1:'H'.repeat(1328079),fc_edit_session_v1:'',fc_projects_v1:'PRIVATE_PROJECT'};
  for(let i=0;i<12;i++)seed['unknown_client_'+i]='V'.repeat(i+1);
  seed.fc_edge_v1='😀\ud800';
  const f=fixture(seed),before=f.snapshot(),r=f.run();
  assert.equal(r.status,'READ_ONLY');assert.equal(r.complete,true);assert.equal(r.consistency,'TWO_PASS_MATCH');
  assert.equal(r.top.length,10);assert.equal(r.keyCount,before.length);assert.equal(r.totalUnits,units(f.rows));
  assert.equal(r.totalKeyUnits+r.totalValueUnits,r.totalUnits);
  assert.deepEqual(r.largest,{rank:1,key:'fc_data_backups_v1',category:'backups',recognized:true,valueUnits:3317250});
  assert.ok(r.top.every((row,i)=>i===0||row.valueUnits<=r.top[i-1].valueUnits));
  assert.equal(r.quotaLimitKnown,false);assert.equal(r.transientWriteCostKnown,false);assert.deepEqual(f.snapshot(),before);
});
test('unknown, dynamic and credential-like names are anonymous, including the largest',()=>{
  for(const [key,category]of [['PRIVATE_CUSTOMER_TOKEN','unknown'],['fc_project_inv_PRIVATE_ID_v1','legacy_project_slot'],['fc_project_inv_PRIVATE_ID_backup_meta_v1','legacy_project_backup'],['firebase:authUser:PRIVATE_TOKEN','unknown'],['fc_data_backups_v1_PRIVATE_ID','unknown']]){
    const f=fixture({[key]:'PRIVATE_VALUE'.repeat(20),fc_ui_v1:'x'}),before=f.snapshot(),r=f.run();
    assert.equal(r.complete,true);assert.equal(r.largest.key,'ANON_01');assert.equal(r.largest.category,category);assert.equal(r.largest.recognized,false);
    assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.ok(!JSON.stringify(r).includes('firebase:'));assert.deepEqual(f.snapshot(),before);
  }
});
test('full storage still permits observation, without a write probe',()=>{
  const f=fixture({fc_rozrys_plan_cache_v2:'P'.repeat(3317250),fc_quote_snapshots_v1:'H'.repeat(1328079),fc_data_backups_v1:'B'.repeat(500000)});
  f.state.capacity=units(f.rows);
  assert.throws(()=>f.storage.setItem('synthetic-probe','x'),{name:'QuotaExceededError'});f.state.writes=0;
  const before=f.snapshot(),r=f.run();assert.equal(r.complete,true);assert.equal(r.largest.category,'cutting_cache');assert.deepEqual(f.snapshot(),before);
});
test('enumeration and value-read failures refuse, without partial results or exception text',()=>{
  for(const failure of ['storage','length','key','get']){
    const f=fixture({fc_ui_v1:'PRIVATE_VALUE'}),before=f.snapshot();
    f.state.hook=type=>{if(type===failure)throw Error('PRIVATE_EXCEPTION_WITH_CUSTOMER_NAME');};
    const r=f.run();refused(r,'STORAGE_READ_FAILED');assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.deepEqual(f.snapshot(),before);
  }
});
test('same-length content change, key insertion and removal are detected',()=>{
  for(const mode of ['content','insert','remove']){
    const f=fixture({fc_ui_v1:'BASE',fc_projects_v1:'PROJECT'});let gets=0,expected;
    f.state.hook=(type,key)=>{
      if(type!=='get')return;
      gets++;
      if((mode==='content'&&gets===3)||(mode!=='content'&&gets===2)){
        if(mode==='content')f.rows.set(key,'X'.repeat(f.rows.get(key).length));
        else if(mode==='insert')f.rows.set('PRIVATE_EXTERNAL_KEY','EXTERNAL');
        else f.rows.delete('fc_projects_v1');
        expected=f.snapshot();
      }
    };
    refused(f.run(),'DIAGNOSTIC_STATE_CHANGED');assert.deepEqual(f.snapshot(),expected,'Only the deliberately simulated external change exists');
  }
});
test('wrong page, missing/tampered gate and denied Auth read no storage',()=>{
  for(const mode of ['denied','wrong-origin','wrong-path','missing','tampered']){
    const f=fixture({fc_projects_v1:'PRIVATE'});
    if(mode==='denied')f.state.authorized=false;
    if(mode==='wrong-origin')f.w.location={origin:'https://example.com',pathname:'/meble-app/'};
    if(mode==='wrong-path')f.w.location={origin:'https://mebleszek.github.io',pathname:'/other/'};
    if(['missing','tampered'].includes(mode)){
      const fake={location:f.w.location,get localStorage(){throw Error('must not read');}};
      if(mode==='tampered')Object.defineProperty(fake,'__FC_MAIN_ACCESS__',{value:{isValid:()=>true},writable:true,configurable:true});
      refused(JSON.parse(vm.runInNewContext(source,{window:fake})),'AUTH_DENIED');continue;
    }
    refused(f.run(),mode.startsWith('wrong-')?'WRONG_PAGE':'AUTH_DENIED');assert.equal(f.state.reads,0);
  }
});
test('Auth revocation during observation and recheck refuses the report',()=>{
  for(const phase of ['first-read','second-read','final-enumeration']){
    const f=fixture({fc_ui_v1:'RAW'}),before=f.snapshot();let gets=0,lengths=0;
    f.state.hook=type=>{
      if(type==='get')gets++;
      if(type==='length')lengths++;
      if((phase==='first-read'&&gets===1)||(phase==='second-read'&&gets===2)||(phase==='final-enumeration'&&lengths===3))f.state.authorized=false;
    };
    refused(f.run(),'AUTH_DENIED');assert.deepEqual(f.snapshot(),before);
  }
});
test('report exposes only fixed fields, safe names, counts and UTF-16 lengths',()=>{
  const f=fixture({fc_quote_snapshots_v1:'PRIVATE_CUSTOMER_PRICE_SECRET',fc_company_profile_v1:'PRIVATE_ORS_SECRET',fc_project_inv_PRIVATE_CLIENT_v1:'PRIVATE_PROJECT',fc_ui_v1:'\ud800😀'}),before=f.snapshot(),r=f.run();
  assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.equal(r.top.find(row=>row.key==='fc_ui_v1').valueUnits,3);
  const fields=['category','key','rank','recognized','valueUnits'];for(const row of r.top)assert.deepEqual(Object.keys(row).sort(),fields);
  assert.deepEqual(f.snapshot(),before);
});
test('empty store and bounded refusal never masquerade as a partial complete report',()=>{
  const empty=fixture().run();assert.equal(empty.complete,true);assert.equal(empty.keyCount,0);assert.equal(empty.largest,null);assert.deepEqual(empty.top,[]);
  const large=fixture({fc_data_backups_v1:'X'.repeat(8*1024*1024)}),before=large.snapshot();
  refused(large.run(),'DIAGNOSTIC_LIMIT_EXCEEDED');assert.deepEqual(large.snapshot(),before);
  const many=fixture(Object.fromEntries(Array.from({length:2001},(_,i)=>['key_'+i,''])));refused(many.run(),'DIAGNOSTIC_LIMIT_EXCEEDED');
  const duplicate=fixture({a:'A',b:'B'});duplicate.storage.key=()=> 'a';refused(duplicate.run(),'DIAGNOSTIC_STATE_CHANGED');
});
console.log('Pixel storage key identification: '+checks+' targeted synthetic groups PASS');
