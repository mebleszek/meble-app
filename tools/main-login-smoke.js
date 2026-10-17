#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
class MemoryStorage{
 constructor(values={}){this.values={...values};this.writes=0;this.removes=0;}
 get length(){return Object.keys(this.values).length;}key(i){return Object.keys(this.values)[i]??null;}
 getItem(key){return this.values[key]??null;}setItem(key,value){this.writes++;this.values[key]=String(value);}removeItem(key){this.removes++;delete this.values[key];}
}
const win={FC:{}};new Function('window','Storage',fs.readFileSync('js/app/cloud/local-access-profile.js','utf8'))(win,MemoryStorage);
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const make=(local={},session={})=>{const l=new MemoryStorage(local),s=new MemoryStorage(session);return {l,s,p:win.FC.localAccessProfile.create(l,s)};};
test('An empty profile binds once, confirms read-back and restores the exact UID',()=>{
 const {l,p}=make();p.confirm('synthetic-owner');assert.equal(l.writes,1);p.confirm('synthetic-owner');assert.equal(l.writes,1);p.assert('synthetic-owner');
 const other=win.FC.localAccessProfile.create(l,new MemoryStorage());other.confirm('synthetic-owner');assert.throws(()=>other.confirm('synthetic-other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(l.writes,1);
});
for(const key of ['fc_projects_v1','fc_price_list_v1','fc_data_backups_v1','hardwareCategories','hardwareSettings','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes'])test('Unclaimed '+key+' is never adopted, read or overwritten',()=>{
 const {l,s,p}=make({[key]:'synthetic-preserved'}),before=JSON.stringify(l.values);let businessReads=0;
 const get=MemoryStorage.prototype.getItem;MemoryStorage.prototype.getItem=function(name){if(name===key)businessReads++;return get.call(this,name);};
 try{assert.throws(()=>p.confirm('synthetic-owner'),/LOCAL_DATA_UNCLAIMED/);assert.equal(JSON.stringify(l.values),before);assert.equal(l.writes+s.writes+l.removes+s.removes,0);assert.equal(businessReads,0);}
 finally{MemoryStorage.prototype.getItem=get;}
});
test('Session/reload evidence also blocks automatic adoption',()=>{const {p,l,s}=make({},{fc_reload_restore_v1:'synthetic-session'});assert.throws(()=>p.confirm('synthetic-owner'),/LOCAL_DATA_UNCLAIMED/);assert.equal(l.writes+s.writes,0);});
test('Corrupt or unsupported access receipts are refused without repair',()=>{
 for(const value of ['bad-json','null','{}','{"version":1,"uid":"owner","extra":true}']){const {p,l}=make({meble_access_profile_v1:value});assert.throws(()=>p.confirm('synthetic-owner'),/LOCAL_ACCESS_INVALID/);assert.equal(l.writes,0);}
});
test('Failed access receipt write/read-back never admits business startup',()=>{
 const {p,l}=make();const original=MemoryStorage.prototype.setItem;
 MemoryStorage.prototype.setItem=function(){throw Error('synthetic-denial');};
 try{const next=win.FC.localAccessProfile.create(l,new MemoryStorage());assert.throws(()=>next.confirm('synthetic-owner'),/synthetic-denial/);}
 finally{MemoryStorage.prototype.setItem=original;}
 const noWrite=new MemoryStorage();
 // A swallowed storage write is detected by raw read-back.
 MemoryStorage.prototype.setItem=function(){};
 try{const next=win.FC.localAccessProfile.create(noWrite,new MemoryStorage());assert.throws(()=>next.confirm('synthetic-owner'),/LOCAL_ACCESS_UNCONFIRMED/);}finally{MemoryStorage.prototype.setItem=original;}
 assert.equal(l.writes,0);assert.throws(()=>p.assert('synthetic-owner'),/LOCAL_ACCESS_UNCONFIRMED/);
});
const consent={backupConfirmed:true,ownerConfirmed:true};
const protectedValues={fc_quote_rates_v1:' {"rate":42} ',fc_accessories_v1:'[{"id":"hardware-1"}]',fc_projects_v1:' [{"id":"project-1"}] ',fc_edit_session_v1:'{"synthetic":"unfinished"}',fc_data_backups_v1:'["preserved"]',hardwareSettings:'legacy-raw',hardwareCategories:'categories-raw',hardwareSuppliers:'suppliers-raw',hardwareTechnicalParams:'params-raw',hardwareTypes:'types-raw',fc_quote_snapshots_v1:'["history"]'};
test('Explicit admission changes only the receipt and preserves every business/session byte',()=>{
 const {l,s,p}=make(protectedValues,{fc_reload_restore_v1:' {"synthetic":true} '}),before={...l.values},session={...s.values};
 const ticket=p.prepareAdmission('synthetic-owner');assert.equal(l.writes+s.writes,0);
 p.admitExisting('synthetic-owner',ticket,consent);p.assert('synthetic-owner');
 assert.deepEqual(l.values,{...before,meble_access_profile_v1:'{"version":1,"uid":"synthetic-owner"}'});assert.deepEqual(s.values,session);
 assert.equal(l.writes,1);assert.equal(s.writes+l.removes+s.removes,0);
 const reopened=win.FC.localAccessProfile.create(l,s);reopened.confirm('synthetic-owner');assert.equal(l.writes,1);
 assert.throws(()=>reopened.confirm('synthetic-other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
});
test('Neither login alone, missing backup nor incomplete owner consent admits existing data',()=>{
 for(const flags of [undefined,{}, {backupConfirmed:true},{ownerConfirmed:true},{backupConfirmed:1,ownerConfirmed:true},{backupConfirmed:true,ownerConfirmed:'true'}]){
  const {l,s,p}=make(protectedValues),before=JSON.stringify(l.values),ticket=p.prepareAdmission('synthetic-owner');
  assert.throws(()=>p.admitExisting('synthetic-owner',ticket,flags),/LOCAL_ACCESS_CONSENT_REQUIRED/);
  assert.throws(()=>p.confirm('synthetic-owner'),/LOCAL_DATA_UNCLAIMED/);assert.equal(JSON.stringify(l.values),before);assert.equal(l.writes+s.writes+l.removes+s.removes,0);
 }
});
test('A changed catalog, active snapshot, removed alias or new key invalidates pending admission',()=>{
 for(const mutate of [l=>l.values.fc_quote_rates_v1='newer',l=>delete l.values.hardwareSettings,l=>l.values.fc_new_key='new',(_l,s)=>s.values.fc_reload_restore_v1='newer']){
  const {l,s,p}=make(protectedValues),ticket=p.prepareAdmission('synthetic-owner');mutate(l,s);const before=JSON.stringify([l.values,s.values]);
  assert.throws(()=>p.admitExisting('synthetic-owner',ticket,consent),/LOCAL_ACCESS_DATA_CHANGED/);assert.equal(JSON.stringify([l.values,s.values]),before);assert.equal(l.writes+s.writes,0);
 }
});
test('Foreign tickets, changed UID and corrupt/foreign receipts cannot admit or overwrite a profile',()=>{
 const {l,s,p}=make(protectedValues),ticket=p.prepareAdmission('synthetic-owner');
 assert.throws(()=>p.admitExisting('synthetic-other',ticket,consent),/LOCAL_ACCESS_UNCONFIRMED/);
 assert.throws(()=>p.admitExisting('synthetic-owner',{},consent),/LOCAL_ACCESS_UNCONFIRMED/);
 const other=win.FC.localAccessProfile.create(l,s);assert.throws(()=>other.admitExisting('synthetic-owner',ticket,consent),/LOCAL_ACCESS_UNCONFIRMED/);
 for(const receipt of ['broken','{"version":1,"uid":"other"}']){
  l.values.meble_access_profile_v1=receipt;assert.throws(()=>p.admitExisting('synthetic-owner',ticket,consent),/LOCAL_ACCESS_INVALID|LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(l.values.meble_access_profile_v1,receipt);
 }
 assert.equal(l.writes+s.writes,0);
});
test('Failed, swallowed or unconfirmed admission writes cannot report success or change business data',()=>{
 const originalSet=MemoryStorage.prototype.setItem,originalGet=MemoryStorage.prototype.getItem;
 for(const kind of ['throw','swallow','readback']){
  const {l,s}=make(protectedValues),before={...l.values};
  MemoryStorage.prototype.setItem=function(k,v){if(kind==='throw')throw Error('synthetic-write-failed');if(kind!=='swallow')originalSet.call(this,k,v);};
  MemoryStorage.prototype.getItem=function(k){if(kind==='readback'&&k==='meble_access_profile_v1'&&this.writes)throw Error('synthetic-readback-failed');return originalGet.call(this,k);};
  try{
   const p=win.FC.localAccessProfile.create(l,s),ticket=p.prepareAdmission('synthetic-owner');
   assert.throws(()=>p.admitExisting('synthetic-owner',ticket,consent),/synthetic-|LOCAL_ACCESS_UNCONFIRMED/);
   assert.deepEqual(Object.fromEntries(Object.entries(l.values).filter(([k])=>k!=='meble_access_profile_v1')),before);assert.equal(s.writes+l.removes+s.removes,0);
  }finally{MemoryStorage.prototype.setItem=originalSet;MemoryStorage.prototype.getItem=originalGet;}
  if(kind==='readback'){
   // A later fresh server-approved attempt may confirm the intended durable receipt,
   // but must never change the UID, repair data or repeat the write.
   const p=win.FC.localAccessProfile.create(l,s);p.confirm('synthetic-owner');assert.equal(l.writes,1);
   assert.throws(()=>p.confirm('synthetic-other'),/LOCAL_ACCESS_OTHER_ACCOUNT/);
  }
 }
});
test('Two prepared admissions are idempotent for one UID, never overwrite a different UID',()=>{
 const {l,s,p}=make(protectedValues),same=win.FC.localAccessProfile.create(l,s),foreign=win.FC.localAccessProfile.create(l,s);
 const a=p.prepareAdmission('owner'),b=same.prepareAdmission('owner'),c=foreign.prepareAdmission('other');
 p.admitExisting('owner',a,consent);same.admitExisting('owner',b,consent);assert.equal(l.writes,1);
 assert.throws(()=>foreign.admitExisting('other',c,consent),/LOCAL_ACCESS_OTHER_ACCOUNT/);
 assert.throws(()=>p.admitExisting('owner',a,consent),/LOCAL_ACCESS_UNCONFIRMED/);assert.equal(l.writes,1);
});
test('A concurrent change during receipt write is refused without destructive compensation',()=>{
 const {l,s}=make(protectedValues),original=MemoryStorage.prototype.setItem;
 MemoryStorage.prototype.setItem=function(k,v){original.call(this,k,v);this.values.fc_quote_rates_v1='newer-concurrent-value';};
 try{
  const p=win.FC.localAccessProfile.create(l,s),ticket=p.prepareAdmission('owner');
  assert.throws(()=>p.admitExisting('owner',ticket,consent),/LOCAL_ACCESS_DATA_CHANGED/);
  assert.equal(l.values.fc_quote_rates_v1,'newer-concurrent-value');assert.equal(l.removes+s.removes,0);
  assert.equal(l.values.meble_access_profile_v1,'{"version":1,"uid":"owner"}');
 }finally{MemoryStorage.prototype.setItem=original;}
});
test('Main manifest keeps every original business script inert, without a second startup list',()=>{
 const html=fs.readFileSync('index.html','utf8'),before=html.split('<template id="business-template">')[0];
 assert.equal(/<script[^>]+src="js\/(?:boot\.js|app\.js|app\/project\/project-store)/.test(before),false);
 const manifest=html.split('<template id="business-template">')[1].split('</template>')[0];assert.equal([...manifest.matchAll(/<script\b/g)].length,323);
 assert.equal(require('./check-index-load-groups').verifyIndex('index.html').errors.length,0);
});
console.log('Main login boundary: '+count+'/'+count+' PASS');
