'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const collect=require('./diagnostics/pixel-session-readonly'),{build}=require('./build-pixel-session-bookmarklet');
const {fixture}=require('./project-navigation-blockers-smoke');
const P='fc_projects_v1',E='fc_edit_session_v1';
const readKeys=new Set([E,P,'fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_edge_v1','fc_material_part_options_v1']);
const tests=[],test=(name,fn)=>tests.push([name,fn]);
async function setup(rows,grant=true){
  const r=fixture(rows||undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});if(!rows)assert.equal(await r.open(),true);
  r.s.location={origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html'};
  let time=1000,identity={uid:'synthetic-owner',epoch:1},lease=null,watch;
  r.s.Date=class extends Date{static now(){return time;}};
  vm.runInContext(fs.readFileSync('js/app/cloud/auth-access-gate.js','utf8'),r.s);
  let emit;
  const auth={identity:()=>identity,subscribe(fn){emit=fn;return()=>{};}};
  r.s.FC.authAccessGate.create(auth,{verifyAccess:async()=>({ok:grant,uid:identity.uid,validUntil:time+45000}),watchAccess(_id,fn){watch=fn;return()=>{};},onAuthorized:value=>{lease=value;},onBlocked:()=>{lease=null;}});
  await emit({status:'authenticated',...identity});
  Object.defineProperty(r.s,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>!!lease&&lease.isValid()}),writable:false,configurable:false});
  r.expire=()=>{time+=45001;};r.revoke=()=>watch({ok:false,denied:true});r.changeUser=()=>{identity={uid:'other',epoch:2};};
  return r;
}
function observe(r,options={}){
  const before=r.seed(),state=JSON.stringify(r.FC.session),snapshot=r.FC.session.snapshot,error=r.FC.session.lastError,ui=JSON.stringify(r.s.uiState);
  const get=r.storage.getItem.bind(r.storage),reads=[],writes=[];
  r.storage.getItem=k=>{reads.push(k);assert.ok(readKeys.has(k),'Unexpected data read');if(options.onRead)options.onRead(k,reads.length);if(options.failRead)throw Error('PRIVATE STORAGE ERROR');return get(k);};
  for(const method of ['setItem','removeItem','clear'])r.storage[method]=()=>{writes.push(method);throw Error('Forbidden storage write');};
  for(const name of ['begin','commit','cancel','canSaveProject','inspectNavigationState','retryInitialBegin'])r.FC.session[name]=()=>{throw Error('Forbidden application call: '+name);};
  r.FC.projectDomainOperations.recoverProject=()=>{throw Error('Forbidden recovery');};
  Object.defineProperty(r.s,'document',{configurable:true,get(){throw Error('DOM access forbidden');}});
  Object.defineProperty(r.s,'navigator',{configurable:true,get(){throw Error('Navigator/clipboard access forbidden');}});
  for(const name of ['fetch','XMLHttpRequest','WebSocket','Image'])r.s[name]=()=>{throw Error('Network forbidden');};
  return {before,state,snapshot,error,ui,reads,writes};
}
function unchanged(r,o){
  assert.deepEqual(r.seed(),o.before);assert.equal(JSON.stringify(r.FC.session),o.state);
  assert.equal(r.FC.session.snapshot,o.snapshot);assert.equal(r.FC.session.lastError,o.error);
  assert.equal(JSON.stringify(r.s.uiState),o.ui);assert.deepEqual(o.writes,[]);
}
test('Complete proof is reported from real modules without any mutation or application call',async()=>{
  const r=await setup(),o=observe(r),out=collect(r.s);
  assert.equal(out.status,'READ_ONLY');for(const key of ['storage','requiredKeys','payloadShape','ownerMatch','contextMatch','ramMatch','expectedKnown','CB','CE','partsMatch'])assert.equal(out[key],key==='storage'?'READABLE':true,key);
  assert.equal(out.pending,false);assert.equal(out.code,'NONE');assert.equal(o.reads.length,14);unchanged(r,o);
});
test('Denied, expired, revoked and changed-UID leases never read business storage',async()=>{
  for(const mode of ['denied','expired','revoked','changed']){
    const r=await setup(null,mode!=='denied');if(mode==='expired')r.expire();if(mode==='revoked')r.revoke();if(mode==='changed')r.changeUser();
    const o=observe(r);assert.deepEqual(collect(r.s),{v:1,status:'AUTH_DENIED'});assert.deepEqual(o.reads,[]);unchanged(r,o);
  }
});
test('A foreign origin or different path cannot inspect the local profile',async()=>{
  for(const location of [{origin:'https://example.invalid',pathname:'/meble-app/'},{origin:'https://mebleszek.github.io',pathname:'/other/'}]){
    const r=await setup();r.s.location=location;const o=observe(r);assert.equal(collect(r.s).status,'WRONG_PAGE');assert.deepEqual(o.reads,[]);unchanged(r,o);
  }
});
test('Actual partial write and fresh restart report C different from B/E without attempting recovery',async()=>{
  const old=await setup();old.storage.fail.set(E,true);old.s.projectData.room_k.cabinets[0].width=65;
  const result=old.FC.project.saveConfirmed(old.s.projectData);assert.equal(result.projectSaved,true);assert.equal(result.ok,false);
  const r=await setup(old.seed());assert.equal(r.FC.session.canSaveProject(),false);
  const o=observe(r),out=collect(r.s);assert.equal(out.CB,false);assert.equal(out.CE,false);assert.equal(out.code,'PROJECT_WRITE_CONFLICT');assert.equal(out.ramMatch,true);unchanged(r,o);
});
test('Acknowledged revision reports C=E and C different from B after restart',async()=>{
  const old=await setup();old.s.projectData.room_k.cabinets[0].width=65;assert.equal(old.FC.project.saveConfirmed(old.s.projectData).ok,true);
  const r=await setup(old.seed()),o=observe(r),out=collect(r.s);assert.equal(out.CB,false);assert.equal(out.CE,true);assert.equal(out.payloadShape,true);unchanged(r,o);
});
test('Missing required snapshot entry does not masquerade as a complete proof',async()=>{
  const r=await setup(),p=JSON.parse(r.storage.getItem(E));delete p.snapshot.fc_edge_v1;r.storage.rows.set(E,JSON.stringify(p));
  const o=observe(r),out=collect(r.s);assert.equal(out.requiredKeys,false);assert.equal(out.payloadShape,false);assert.equal(out.ramMatch,false);unchanged(r,o);
});
test('Corrupt payload, missing owner, wrong active project and pending operation stay read-only',async()=>{
  for(const mode of ['corrupt','owner','context','pending']){
    const r=await setup();
    if(mode==='corrupt')r.storage.rows.set(E,'{');
    if(mode==='context')r.storage.rows.set('fc_current_project_id_v1','Q');
    if(['owner','pending'].includes(mode)){let rows=JSON.parse(r.storage.getItem(P));if(mode==='owner')rows=rows.filter(row=>row.id!=='P');else rows.find(row=>row.id==='P').meta.pendingDomainOperation={version:1};r.storage.rows.set(P,JSON.stringify(rows));}
    const o=observe(r),out=collect(r.s);assert.equal(out.status,'READ_ONLY');
    if(mode==='corrupt')assert.equal(out.payloadShape,false);if(mode==='owner')assert.equal(out.ownerMatch,false);if(mode==='context')assert.equal(out.contextMatch,false);if(mode==='pending')assert.equal(out.pending,true);unchanged(r,o);
  }
});
test('Private values, arbitrary errors and malicious schema strings never enter output',async()=>{
  const r=await setup(),secret='PRIVATE_NAME_ID_TOKEN_APIKEY_SENTINEL';
  r.FC.session.lastError={code:secret,message:secret};r.s.projectData.private=secret;
  const p=JSON.parse(r.storage.getItem(E));p.schemaVersion=secret;p.private=secret;r.storage.rows.set(E,JSON.stringify(p));
  const o=observe(r),out=collect(r.s),text=JSON.stringify(out);assert.equal(out.code,'OTHER');assert.equal(out.schema,'OTHER');assert.equal(text.includes(secret),false);assert.ok(text.length<800);unchanged(r,o);
});
test('Unreadable storage refuses without a probe write or exception details',async()=>{
  const r=await setup(),o=observe(r,{failRead:true});assert.deepEqual(collect(r.s),{v:1,status:'STORAGE_UNREADABLE'});unchanged(r,o);
});
test('Legacy schema, unknown revision and changed global part keys are observations, never permissions',async()=>{
  for(const mode of ['legacy','unknown','parts']){
    const r=await setup(),p=JSON.parse(r.storage.getItem(E));
    if(mode==='legacy')p.schemaVersion=3;if(mode==='unknown')p.expectedOwnerKnown=false;
    r.storage.rows.set(E,JSON.stringify(p));if(mode==='parts')r.storage.rows.set('fc_edge_v1','{"PRIVATE":"legacy edge choice"}');
    const o=observe(r),out=collect(r.s);assert.equal(out.status,'READ_ONLY');
    if(mode==='legacy'){assert.equal(out.schema,3);assert.equal(out.payloadShape,false);}
    if(mode==='unknown'){assert.equal(out.expectedKnown,false);assert.equal(out.payloadShape,false);}
    if(mode==='parts')assert.equal(out.partsMatch,false);unchanged(r,o);
  }
});
test('A changed physical record during observation is refused and the external change is preserved',async()=>{
  const r=await setup();let external;
  const o=observe(r,{onRead(_k,n){if(n===8){const rows=JSON.parse(r.storage.rows.get(P));rows.find(row=>row.id==='P').projectData.room_k.cabinets[0].width=88;external=JSON.stringify(rows);r.storage.rows.set(P,external);}}});
  assert.deepEqual(collect(r.s),{v:1,status:'DIAGNOSTIC_STATE_CHANGED'});assert.equal(r.storage.rows.get(P),external);assert.equal(r.storage.rows.get(E),o.before[E]);assert.deepEqual(o.writes,[]);
});
test('An expired lease during collection never returns the observed report',async()=>{
  const r=await setup(),o=observe(r,{onRead(_k,n){if(n===7)r.expire();}});assert.deepEqual(collect(r.s),{v:1,status:'AUTH_DENIED'});unchanged(r,o);
});
test('Replacement of the RAM session during observation is rejected without modifying either snapshot',async()=>{
  const r=await setup(),original=r.FC.session,originalBytes=JSON.stringify(original);
  const o=observe(r,{onRead(_k,n){if(n===8)r.s.FC.session={active:false};}});
  assert.deepEqual(collect(r.s),{v:1,status:'DIAGNOSTIC_STATE_CHANGED'});
  assert.deepEqual(r.seed(),o.before);assert.equal(JSON.stringify(original),originalBytes);assert.deepEqual(o.writes,[]);
});
test('Bookmarklet returns void and writes only the sanitized output JSON to the clipboard',async()=>{
  const r=await setup(),o=observe(r);let value;
  Object.defineProperty(r.s,'navigator',{configurable:true,value:{clipboard:{async writeText(text){value=text;}}}});
  r.s.prompt=()=>{throw Error('Modal output forbidden');};
  const url=build();assert.equal(fs.readFileSync('tools/diagnostics/pixel-session-bookmarklet.txt','utf8'),url+'\n');
  assert.equal(vm.runInContext(url.slice('javascript:'.length),r.s),undefined);
  assert.equal(JSON.parse(value).status,'READ_ONLY');assert.ok(value.length<800);unchanged(r,o);
});
test('Clipboard refusal has no DOM, dialog, download or application-storage fallback',async()=>{
  const r=await setup(),o=observe(r);let copies=0;
  Object.defineProperty(r.s,'navigator',{configurable:true,value:{clipboard:{async writeText(){copies++;throw Error('PRIVATE_PERMISSION_ERROR');}}}});
  r.s.prompt=()=>{throw Error('Modal fallback forbidden');};
  assert.equal(vm.runInContext(build().slice('javascript:'.length),r.s),undefined);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(copies,1);unchanged(r,o);
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();
