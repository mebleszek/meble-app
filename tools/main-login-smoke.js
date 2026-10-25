#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
class MemoryStorage{
 constructor(values={}){this.values={...values};this.writes=0;this.removes=0;}
 get length(){return Object.keys(this.values).length;}key(i){return Object.keys(this.values)[i]??null;}
 getItem(key){return this.values[key]??null;}setItem(key,value){this.writes++;this.values[key]=String(value);}removeItem(key){this.removes++;delete this.values[key];}
}
const win={FC:{},crypto:require("node:crypto").webcrypto};new Function('window','Storage',fs.readFileSync('js/app/cloud/local-access-profile.js','utf8'))(win,MemoryStorage);
const factories=new WeakMap(),create=win.FC.localAccessProfile.create,indexedDBFixture=require('./helpers/profile-indexeddb-fixture');
win.FC.localAccessProfile.create=(local,session,options={})=>{
 if(!factories.has(local))factories.set(local,indexedDBFixture());
 return create(local,session,{indexedDB:factories.get(local),...options});
};
const tests=[];function test(name,fn){tests.push([name,fn]);}
const make=(local={},session={})=>{const l=new MemoryStorage(local),s=new MemoryStorage(session);return {l,s,p:win.FC.localAccessProfile.create(l,s)};};
test('An empty profile binds once, confirms read-back and restores the exact UID',async()=>{
 const {l,p}=make();await p.confirm('synthetic-owner');assert.equal(l.writes,2);await p.confirm('synthetic-owner');assert.equal(l.writes,2);p.assert('synthetic-owner');
 const other=win.FC.localAccessProfile.create(l,new MemoryStorage());await other.confirm('synthetic-owner');await assert.rejects(()=>other.confirm('synthetic-other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(l.writes,2);
});
for(const key of ['fc_projects_v1','fc_price_list_v1','fc_data_backups_v1','hardwareCategories','hardwareSettings','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes'])test('Unclaimed '+key+' is never adopted, read or overwritten',async()=>{
 const {l,s,p}=make({[key]:'synthetic-preserved'}),before=JSON.stringify(l.values);let businessReads=0;
 const get=MemoryStorage.prototype.getItem;MemoryStorage.prototype.getItem=function(name){if(name===key)businessReads++;return get.call(this,name);};
 try{await assert.rejects(()=>p.confirm('synthetic-owner'),/LOCAL_DATA_UNCLAIMED/);assert.equal(JSON.stringify(l.values),before);assert.equal(l.writes+s.writes+l.removes+s.removes,0);assert.equal(businessReads,0);}
 finally{MemoryStorage.prototype.getItem=get;}
});
test('Session/reload evidence also blocks automatic adoption',async()=>{const {p,l,s}=make({},{fc_reload_restore_v1:'synthetic-session'});await assert.rejects(()=>p.confirm('synthetic-owner'),/LOCAL_DATA_UNCLAIMED/);assert.equal(l.writes+s.writes,0);});
test('Corrupt or unsupported access receipts are refused without repair',async()=>{
 for(const value of ['bad-json','null','{}','{"version":1,"uid":"owner","extra":true}']){const {p,l}=make({meble_access_profile_v1:value});await assert.rejects(()=>p.confirm('synthetic-owner'),/LOCAL_ACCESS_INVALID/);assert.equal(l.writes,0);}
});
test('Failed access receipt write/read-back never admits business startup',async()=>{
 const {p,l}=make();const original=MemoryStorage.prototype.setItem;
 MemoryStorage.prototype.setItem=function(){throw Error('synthetic-denial');};
 try{const next=win.FC.localAccessProfile.create(l,new MemoryStorage());await assert.rejects(()=>next.confirm('synthetic-owner'),/LOCAL_ACCESS_UNCONFIRMED/);}
 finally{MemoryStorage.prototype.setItem=original;}
 const noWrite=new MemoryStorage();
 // A swallowed storage write is detected by raw read-back.
 MemoryStorage.prototype.setItem=function(){};
 try{const next=win.FC.localAccessProfile.create(noWrite,new MemoryStorage());await assert.rejects(()=>next.confirm('synthetic-owner'),/LOCAL_ACCESS_UNCONFIRMED/);}finally{MemoryStorage.prototype.setItem=original;}
 assert.equal(l.writes,0);assert.throws(()=>p.assert('synthetic-owner'),/LOCAL_ACCESS_UNCONFIRMED/);
});
const consent={backupConfirmed:true,ownerConfirmed:true};
const protectedValues={fc_quote_rates_v1:' {"rate":42} ',fc_accessories_v1:'[{"id":"hardware-1"}]',fc_projects_v1:' [{"id":"project-1"}] ',fc_edit_session_v1:'{"synthetic":"unfinished"}',fc_data_backups_v1:'["preserved"]',hardwareSettings:'legacy-raw',hardwareCategories:'categories-raw',hardwareSuppliers:'suppliers-raw',hardwareTechnicalParams:'params-raw',hardwareTypes:'types-raw',fc_quote_snapshots_v1:'["history"]'};
test('Explicit admission changes only the receipt and preserves every business/session byte',async()=>{
 const {l,s,p}=make(protectedValues,{fc_reload_restore_v1:' {"synthetic":true} '}),before={...l.values},session={...s.values};
 const ticket=await p.prepareAdmission('synthetic-owner');assert.equal(l.writes+s.writes,0);
 await p.admitExisting('synthetic-owner',ticket,consent);p.assert('synthetic-owner');
 const receipt=JSON.parse(l.values.meble_access_profile_v1);assert.equal(receipt.version,3);assert.equal(receipt.uid,'synthetic-owner');assert.ok(receipt.attemptId);
 assert.deepEqual(l.values,{...before,meble_access_profile_v1:JSON.stringify(receipt)});assert.deepEqual(s.values,session);
 assert.equal(l.writes,2);assert.equal(l.removes,1);assert.equal(s.writes+s.removes,0);
 const reopened=win.FC.localAccessProfile.create(l,s);await reopened.confirm('synthetic-owner');assert.equal(l.writes,2);
 await assert.rejects(()=>reopened.confirm('synthetic-other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
});
test('Neither login alone, missing backup nor incomplete owner consent admits existing data',async()=>{
 for(const flags of [undefined,{}, {backupConfirmed:true},{ownerConfirmed:true},{backupConfirmed:1,ownerConfirmed:true},{backupConfirmed:true,ownerConfirmed:'true'}]){
  const {l,s,p}=make(protectedValues),before=JSON.stringify(l.values),ticket=await p.prepareAdmission('synthetic-owner');
  await assert.rejects(()=>p.admitExisting('synthetic-owner',ticket,flags),/LOCAL_ACCESS_CONSENT_REQUIRED/);
  await assert.rejects(()=>p.confirm('synthetic-owner'),/LOCAL_DATA_UNCLAIMED/);assert.equal(JSON.stringify(l.values),before);assert.equal(l.writes+s.writes+l.removes+s.removes,0);
 }
});
test('A changed catalog, active snapshot, removed alias or new key invalidates pending admission',async()=>{
 for(const mutate of [l=>l.values.fc_quote_rates_v1='newer',l=>delete l.values.hardwareSettings,l=>l.values.fc_new_key='new',(_l,s)=>s.values.fc_reload_restore_v1='newer']){
  const {l,s,p}=make(protectedValues),ticket=await p.prepareAdmission('synthetic-owner');mutate(l,s);const before=JSON.stringify([l.values,s.values]);
  await assert.rejects(()=>p.admitExisting('synthetic-owner',ticket,consent),/LOCAL_ACCESS_DATA_CHANGED/);assert.equal(JSON.stringify([l.values,s.values]),before);assert.equal(l.writes+s.writes,0);
 }
});
test('Foreign tickets, changed UID and corrupt/foreign receipts cannot admit or overwrite a profile',async()=>{
 const {l,s,p}=make(protectedValues),ticket=await p.prepareAdmission('synthetic-owner');
 await assert.rejects(()=>p.admitExisting('synthetic-other',ticket,consent),/LOCAL_ACCESS_UNCONFIRMED/);
 await assert.rejects(()=>p.admitExisting('synthetic-owner',{},consent),/LOCAL_ACCESS_UNCONFIRMED/);
 const other=win.FC.localAccessProfile.create(l,s);await assert.rejects(()=>other.admitExisting('synthetic-owner',ticket,consent),/LOCAL_ACCESS_UNCONFIRMED/);
 for(const receipt of ['broken','{"version":1,"uid":"other"}']){
  const fixture=make(protectedValues),fresh=await fixture.p.prepareAdmission('synthetic-owner');
  fixture.l.values.meble_access_profile_v1=receipt;await assert.rejects(()=>fixture.p.admitExisting('synthetic-owner',fresh,consent),/LOCAL_ACCESS_INVALID|LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(fixture.l.values.meble_access_profile_v1,receipt);assert.equal(fixture.l.writes,0);
 }
 assert.equal(l.writes+s.writes,0);
});
test('Failed, swallowed or unconfirmed admission writes cannot report success or change business data',async()=>{
 const originalSet=MemoryStorage.prototype.setItem,originalGet=MemoryStorage.prototype.getItem;
 for(const kind of ['throw','swallow','readback']){
  const {l,s}=make(protectedValues),before={...l.values};
  MemoryStorage.prototype.setItem=function(k,v){if(kind==='throw')throw Error('synthetic-write-failed');if(kind!=='swallow')originalSet.call(this,k,v);};
  MemoryStorage.prototype.getItem=function(k){if(kind==='readback'&&k==='meble_access_profile_v1'&&this.values[k])throw Error('synthetic-readback-failed');return originalGet.call(this,k);};
  try{
   const p=win.FC.localAccessProfile.create(l,s),ticket=await p.prepareAdmission('synthetic-owner');
   await assert.rejects(()=>p.admitExisting('synthetic-owner',ticket,consent),/synthetic-|LOCAL_ACCESS_UNCONFIRMED/);
   assert.deepEqual(Object.fromEntries(Object.entries(l.values).filter(([k])=>!k.startsWith('meble_access_profile_'))),before);assert.equal(s.writes+l.removes+s.removes,0);
  }finally{MemoryStorage.prototype.setItem=originalSet;MemoryStorage.prototype.getItem=originalGet;}
  if(kind==='readback'){
   // A new instance must NOT trust the persisted candidate after lost read-back.
   const p=win.FC.localAccessProfile.create(l,s);await assert.rejects(()=>p.confirm('synthetic-owner'),/LOCAL_DATA_UNCLAIMED/);assert.throws(()=>p.assert('synthetic-owner'),/LOCAL_ACCESS_UNCONFIRMED/);
   await assert.rejects(()=>p.confirm('synthetic-other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
  }
 }
});
test('Two prepared admissions are idempotent for one UID, never overwrite a different UID',async()=>{
 const {l,s,p}=make(protectedValues),same=win.FC.localAccessProfile.create(l,s),foreign=win.FC.localAccessProfile.create(l,s);
 const a=await p.prepareAdmission('owner'),b=await same.prepareAdmission('owner'),c=await foreign.prepareAdmission('other');
 await p.admitExisting('owner',a,consent);await same.admitExisting('owner',b,consent);assert.equal(l.writes,2);
 await assert.rejects(()=>foreign.admitExisting('other',c,consent),/LOCAL_ACCESS_OTHER_ACCOUNT/);
 await assert.rejects(()=>p.admitExisting('owner',a,consent),/LOCAL_ACCESS_UNCONFIRMED/);assert.equal(l.writes,2);
});
test('A concurrent change during receipt write is refused without destructive compensation',async()=>{
 const {l,s}=make(protectedValues),original=MemoryStorage.prototype.setItem;
 MemoryStorage.prototype.setItem=function(k,v){original.call(this,k,v);if(k==='meble_access_profile_v1')this.values.fc_quote_rates_v1='newer-concurrent-value';};
 try{
  const p=win.FC.localAccessProfile.create(l,s),ticket=await p.prepareAdmission('owner');
  await assert.rejects(()=>p.admitExisting('owner',ticket,consent),/LOCAL_ACCESS_DATA_CHANGED/);
  assert.equal(l.values.fc_quote_rates_v1,'newer-concurrent-value');assert.equal(l.removes+s.removes,0);
  const restarted=win.FC.localAccessProfile.create(l,s);await assert.rejects(()=>restarted.confirm('owner'),/LOCAL_DATA_UNCLAIMED/);
 }finally{MemoryStorage.prototype.setItem=original;}
});
test('Every interrupted binding stays untrusted across restart and needs a new ticket and explicit consent',async()=>{
 const proto=MemoryStorage.prototype,original={set:proto.setItem,get:proto.getItem,remove:proto.removeItem};
 for(const kind of ['data-change','pending-readback','candidate-readback','commit-removal']){
  const {l,s}=make(protectedValues),businessBefore={...l.values};let armed=true;
  proto.setItem=function(k,v){original.set.call(this,k,v);if(armed&&kind==='data-change'&&k==='meble_access_profile_v1')this.values.fc_quote_rates_v1='newer-concurrent-value';};
  proto.getItem=function(k){if(armed&&((kind==='pending-readback'&&k==='meble_access_profile_pending_v1'&&this.values[k])||(kind==='candidate-readback'&&k==='meble_access_profile_v1'&&this.values[k])))throw Error('synthetic readback failure');return original.get.call(this,k);};
  proto.removeItem=function(k){if(armed&&kind==='commit-removal'&&k==='meble_access_profile_pending_v1')throw Error('synthetic atomic remove failure');return original.remove.call(this,k);};
  try{
   const p=win.FC.localAccessProfile.create(l,s),ticket=await p.prepareAdmission('owner');
   await assert.rejects(()=>p.admitExisting('owner',ticket,consent),kind==='data-change'?/LOCAL_ACCESS_DATA_CHANGED/:/LOCAL_ACCESS_UNCONFIRMED/);
   armed=false;
   assert.ok(l.values.meble_access_profile_pending_v1,'a durable veto must survive every failed candidate write');
   await assert.rejects(()=>p.admitExisting('owner',ticket,consent),/LOCAL_ACCESS_UNCONFIRMED/,'a failed ticket cannot be replayed');
   const restarted=win.FC.localAccessProfile.create(l,s);
   await assert.rejects(()=>restarted.confirm('owner'),/LOCAL_DATA_UNCLAIMED/);assert.throws(()=>restarted.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);
   await assert.rejects(()=>restarted.confirm('other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
   const fresh=await restarted.prepareAdmission('owner');await assert.rejects(()=>restarted.admitExisting('owner',fresh,{}),/LOCAL_ACCESS_CONSENT_REQUIRED/);
   await restarted.admitExisting('owner',fresh,consent);
   assert.equal(l.values.meble_access_profile_pending_v1,undefined);
   const successfulRestart=win.FC.localAccessProfile.create(l,s);await successfulRestart.confirm('owner');successfulRestart.assert('owner');
   const business=Object.fromEntries(Object.entries(l.values).filter(([k])=>!k.startsWith('meble_access_profile_')));
   assert.deepEqual(business,{...businessBefore,...(kind==='data-change'?{fc_quote_rates_v1:'newer-concurrent-value'}:{})});assert.equal(s.writes+s.removes,0);
  }finally{proto.setItem=original.set;proto.getItem=original.get;proto.removeItem=original.remove;}
 }
});
test('Old v1 receipts never prove a successful admission, even in an otherwise empty profile',async()=>{
 for(const values of [{},protectedValues]){
  const {l,s,p}=make({...values,meble_access_profile_v1:'{"version":1,"uid":"owner"}'}),before={...l.values};
  await assert.rejects(()=>p.confirm('owner'),/LOCAL_DATA_UNCLAIMED/);assert.throws(()=>p.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);
  assert.deepEqual(l.values,before);assert.equal(l.writes+s.writes+l.removes+s.removes,0);
  const ticket=await p.prepareAdmission('owner');await p.admitExisting('owner',ticket,consent);assert.equal(JSON.parse(l.values.meble_access_profile_v1).version,3);
  await win.FC.localAccessProfile.create(l,s).confirm('owner');
 }
});
test('An incomplete empty-profile binding also cannot be auto-admitted on restart',async()=>{
 const {l,s}=make(),get=MemoryStorage.prototype.getItem;
 MemoryStorage.prototype.getItem=function(k){if(k==='meble_access_profile_v1'&&this.values[k])throw Error('readback failed');return get.call(this,k);};
 try{const p=win.FC.localAccessProfile.create(l,s);await assert.rejects(()=>p.confirm('owner'),/LOCAL_ACCESS_UNCONFIRMED/);}finally{MemoryStorage.prototype.getItem=get;}
 const restarted=win.FC.localAccessProfile.create(l,s);await assert.rejects(()=>restarted.confirm('owner'),/LOCAL_DATA_UNCLAIMED/);assert.throws(()=>restarted.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);
});
test('Corrupt and foreign pending barriers are refused without repair',async()=>{
 for(const raw of ['bad-json','null','{}','{"version":1,"uid":"other","attemptId":"00000000-0000-4000-8000-000000000001"}']){
  const {l,p}=make({...protectedValues,meble_access_profile_pending_v1:raw});
  await assert.rejects(()=>p.confirm('owner'),/LOCAL_ACCESS_INVALID|LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(l.values.meble_access_profile_pending_v1,raw);assert.equal(l.writes+l.removes,0);
 }
});
test('Actual standard export preserves included RAW but omits aliases, sessions, rescue copies and the backup archive',async()=>{
 const excluded=['fc_data_backups_v1','fc_project_backup_v1','fc_project_backup_meta_v1','fc_investors_backup_v1','fc_investors_backup_meta_v1','fc_project_inv_synthetic_backup_v1','fc_project_inv_synthetic_backup_meta_v1','fc_edit_session_v1','fc_reload_restore_v1','fc_rozrys_plan_cache_v1','fc_rozrys_plan_cache_v2','hardwareSettings','hardwareCategories','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes','meble_access_profile_v1','meble_access_profile_pending_v1'];
 const included=['fc_projects_v1','fc_investors_v1','fc_quote_rates_v1','fc_services_v1','fc_accessories_v1','fc_sheet_materials_v1','fc_materials_v1','fc_program_defaults_v1','fc_sheets_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_rozrys_overrides_v1','fc_company_profile_v1'];
 const values=Object.fromEntries([...excluded,...included].map(k=>[k,JSON.stringify({synthetic:k})]));
 values.fc_company_profile_v1='{"transport":{"apiKey":"SYNTHETIC_NOT_A_REAL_ORS_SECRET"}}';
 const l=new MemoryStorage(values),session=new MemoryStorage({fc_reload_restore_v1:'session-only'}),w={FC:{}};
 for(const file of ['data-storage-keys','data-backup-snapshot-normalizer','data-backup-export','data-backup-snapshot'])new Function('window','localStorage','sessionStorage',fs.readFileSync('js/app/shared/'+file+'.js','utf8'))(w,l,session);
 const before=JSON.stringify([l.values,session.values]),snapshot=w.FC.dataBackupSnapshot.collectSnapshot({reason:'synthetic-read-only-test'}),copy=w.FC.dataBackupExport.makeExportPayload(snapshot);
 assert.equal(copy.kind,'meble-app-data-export');assert.equal(copy.version,1);
 assert.deepEqual(Object.keys(copy.snapshot.keys).sort(),included.sort());
 for(const k of included)assert.equal(copy.snapshot.keys[k],values[k]);
 for(const k of excluded)assert.equal(k in copy.snapshot.keys,false,k+' remains outside standard export');
 assert.equal(JSON.stringify([l.values,session.values]),before);assert.equal(l.writes+session.writes+l.removes+session.removes,0);
});
test('Main manifest keeps every original business script inert, without a second startup list',async()=>{
 const html=fs.readFileSync('index.html','utf8'),before=html.split('<template id="business-template">')[0];
 assert.equal(/<script[^>]+src="js\/(?:boot\.js|app\.js|app\/project\/project-store)/.test(before),false);
 const {INDEX_LOAD_GROUPS}=require('./index-load-groups');
 const expected=INDEX_LOAD_GROUPS.filter(group=>group.id!=='auth-shell').flatMap(group=>group.scripts);
 assert.equal(new Set(expected).size,expected.length,'Canonical business manifest must be unique');
 function checkManifest(document){
  const sections=document.split('<template id="business-template">');assert.equal(sections.length,2,'Exactly one inert business template');
  const manifest=sections[1].split('</template>')[0];
  const actual=[...manifest.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(match=>match[1].split('?')[0]);
  assert.equal([...manifest.matchAll(/<script\b/gi)].length,expected.length,'Every canonical business script is inert, no extra inline scripts');
  assert.equal(new Set(actual).size,actual.length,'Business scripts must be unique');
  assert.deepEqual(actual,expected,'Exact canonical completeness and order inside the template');
 }
 checkManifest(html);
 const first=html.match(/<script[^>]+src="js\/boot\.js[^>]*><\/script>/)[0];
 const second=html.match(/<script[^>]+src="js\/core\/actions\.js[^>]*><\/script>/)[0];
 for(const mutated of [html.replace(first,''),html.replace(first,second),html.replace(first,'<!--SWAP-->').replace(second,first).replace('<!--SWAP-->',second),html.replace(first,'<script></script>')]){
  assert.throws(()=>checkManifest(mutated),assert.AssertionError,'Missing, duplicated, reordered or inline replacement must fail');
 }
 const manifest=html.split('<template id="business-template">')[1].split('</template>')[0];
 for(const file of ['session-diagnostics-readonly.js','session-diagnostics.js']){
  assert.equal(before.includes('js/app/ui/'+file),false,'Diagnostics must not load before Auth');
  assert.equal(manifest.split('src="js/app/ui/'+file+'?').length-1,1,'One protected diagnostic script');
 }
 assert.equal(require('./check-index-load-groups').verifyIndex('index.html').errors.length,0);
});
test('Missing/unavailable transactional storage never falls back to localStorage trust',async()=>{
 for(const option of [null,{open(){throw Error('denied');}}]){
  const {l,s}=make(),p=create(l,s,{indexedDB:option});
  await assert.rejects(()=>p.confirm('owner'),/LOCAL_ACCESS_COORDINATION_UNAVAILABLE/);
  assert.throws(()=>p.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);assert.equal(l.writes+s.writes,0);
 }
});
test('Stale independent localStorage views cannot assign two UIDs against one transactional owner',async()=>{
 const db=indexedDBFixture(),a=make(protectedValues),b=make(protectedValues);
 const first=create(a.l,a.s,{indexedDB:db}),second=create(b.l,b.s,{indexedDB:db});
 const t1=await first.prepareAdmission('owner'),t2=await second.prepareAdmission('other');
 await first.admitExisting('owner',t1,consent);
 assert.equal(b.l.getItem('meble_access_profile_v1'),null,'force the original stale read deterministically');
 await assert.rejects(()=>second.admitExisting('other',t2,consent),/LOCAL_ACCESS_OTHER_ACCOUNT/);
 assert.equal(db.rows.get('owner').uid,'owner');assert.equal(b.l.writes+b.l.removes,0);
 first.assert('owner');await assert.rejects(()=>second.confirm('other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
});
test('Same UID concurrent admissions share one reservation and both restore safely',async()=>{
 const {l,s,p}=make(protectedValues),same=win.FC.localAccessProfile.create(l,s);
 const a=await p.prepareAdmission('owner'),b=await same.prepareAdmission('owner');
 await Promise.all([p.admitExisting('owner',a,consent),same.admitExisting('owner',b,consent)]);
 p.assert('owner');same.assert('owner');assert.equal(factories.get(l).rows.get('owner').state,'active');
});
test('Every transaction failure before activation preserves data and refuses after restart',async()=>{
 for(const phase of ['open','transaction','get','put','readback','commit']){
  const {l,s,p}=make(protectedValues),db=factories.get(l),before=JSON.stringify([l.values,s.values]);
  const ticket=['put','readback','commit'].includes(phase)?await p.prepareAdmission('owner'):null;db.fail=phase;
  await assert.rejects(()=>ticket?p.admitExisting('owner',ticket,consent):p.confirm('owner'),/LOCAL_ACCESS_/);assert.throws(()=>p.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);
  assert.equal(JSON.stringify([l.values,s.values]),before);assert.equal(l.writes+s.writes,0);
  db.fail=null;const next=win.FC.localAccessProfile.create(l,s);await assert.rejects(()=>next.confirm('owner'),/LOCAL_DATA_UNCLAIMED/);
 }
});
test('Failure after the legacy seal but before IDB commit cannot turn a candidate into acknowledged access',async()=>{
 for(const fault of ['readback','commit','business-change','revoke']){
  const {l,s,p}=make(protectedValues),db=factories.get(l),ticket=await p.prepareAdmission('owner');
  db.afterPut=value=>{if(value.state==='active'){
   if(fault==='business-change')l.values.fc_quote_rates_v1='preserve-newer-value';
   else if(fault==='revoke')p.revoke();else db.fail=fault;
  }};
  await assert.rejects(()=>p.admitExisting('owner',ticket,consent),/LOCAL_ACCESS_/);
  assert.equal(db.rows.get('owner').state,'pending');assert.equal(l.values.meble_access_profile_pending_v1,undefined,'legacy removal alone is never the new authority');
  assert.throws(()=>p.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);
  db.afterPut=null;db.fail=null;const restarted=win.FC.localAccessProfile.create(l,s);
  await assert.rejects(()=>restarted.confirm('owner'),/LOCAL_DATA_UNCLAIMED/);
  await assert.rejects(()=>restarted.confirm('other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
  const fresh=await restarted.prepareAdmission('owner');await restarted.admitExisting('owner',fresh,consent);
  await win.FC.localAccessProfile.create(l,s).confirm('owner');
  for(const [key,value]of Object.entries(protectedValues))assert.equal(l.values[key],fault==='business-change'&&key==='fc_quote_rates_v1'?'preserve-newer-value':value);
 }
});
test('Acknowledged v2 transitions atomically without rewriting any legacy byte; v1 and pending do not',async()=>{
 const raw='{ "version":2,"uid":"owner","attemptId":"00000000-0000-4000-8000-000000000001" }';
 const {l,s,p}=make({...protectedValues,meble_access_profile_v1:raw}),before=JSON.stringify([l.values,s.values]);
 await p.confirm('owner');p.assert('owner');assert.equal(JSON.stringify([l.values,s.values]),before);assert.equal(l.writes+l.removes,0);
 assert.equal(factories.get(l).rows.get('owner').uid,'owner');
 await win.FC.localAccessProfile.create(l,s).confirm('owner');
 await assert.rejects(()=>win.FC.localAccessProfile.create(l,s).confirm('other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
});
test('Malformed, unsupported or conflicting coordinator records are refused without repair',async()=>{
 for(const value of [null,{}, Object.assign([],{version:1,uid:'owner',state:'active',attemptId:'00000000-0000-4000-8000-000000000001'}), {version:2,uid:'owner',state:'active',attemptId:'bad'}, {version:1,uid:'other',state:'pending',attemptId:'00000000-0000-4000-8000-000000000001'}]){
  const {l,s,p}=make(protectedValues),db=factories.get(l);db.rows.set('owner',value);const before=JSON.stringify([l.values,s.values]);
  await assert.rejects(()=>p.confirm('owner'),/LOCAL_ACCESS_COORDINATION_INVALID|LOCAL_ACCESS_OTHER_ACCOUNT/);
  assert.equal(JSON.stringify([l.values,s.values]),before);assert.deepEqual(db.rows.get('owner'),value);
 }
});
test('A changed Auth epoch, logout or explicit revoke invalidates prepared consent and cached access',async()=>{
 const {l,s}=make(protectedValues),db=factories.get(l);let epoch=1,enabled=true;
 const p=create(l,s,{indexedDB:db,authorize(){if(!enabled)throw Error('AUTH_ACCESS_REVOKED');return epoch;}});
 const ticket=await p.prepareAdmission('owner');epoch++;
 await assert.rejects(()=>p.admitExisting('owner',ticket,consent),/LOCAL_ACCESS_UNCONFIRMED/);assert.equal(l.writes,0);
 const fresh=await p.prepareAdmission('owner');await p.admitExisting('owner',fresh,consent);p.assert('owner');
 enabled=false;assert.throws(()=>p.assert('owner'),/AUTH_ACCESS_REVOKED/);p.revoke();enabled=true;
 assert.throws(()=>p.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);await p.confirm('owner');p.assert('owner');
});
test('The main screen contains no UID display or handler and retains the unapproved-account message',async()=>{
 const html=fs.readFileSync('index.html','utf8'),code=fs.readFileSync('js/main-login.js','utf8'),css=fs.readFileSync('css/auth-test.css','utf8');
 for(const source of [html,code,css])assert.equal(/auth-uid|Pokaż Firebase UID/.test(source),false);
 assert.match(code,/Dostęp do aplikacji nie został zatwierdzony/);
});
test('A v3 candidate without its coordinator cannot be silently adopted, including an empty profile',async()=>{
 const raw='{"version":3,"uid":"owner","attemptId":"00000000-0000-4000-8000-000000000001"}';
 const {l,s,p}=make({meble_access_profile_v1:raw});
 await assert.rejects(()=>p.confirm('owner'),/LOCAL_DATA_UNCLAIMED/);assert.equal(l.writes+l.removes,0);
 const ticket=await p.prepareAdmission('owner');await p.admitExisting('owner',ticket,consent);p.assert('owner');
});
test('Failed re-confirmation cannot retain a previously cached owner authorization',async()=>{
 const {l,p}=make();await p.confirm('owner');p.assert('owner');factories.get(l).fail='transaction';
 await assert.rejects(()=>p.confirm('owner'),/LOCAL_ACCESS_COORDINATION_UNAVAILABLE/);
 assert.throws(()=>p.assert('owner'),/LOCAL_ACCESS_UNCONFIRMED/);
});
async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('Main login boundary: '+tests.length+'/'+tests.length+' PASS');}
main().catch(error=>{console.error(error);process.exitCode=1;});
