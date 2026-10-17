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
test('Main manifest keeps every original business script inert, without a second startup list',()=>{
 const html=fs.readFileSync('index.html','utf8'),before=html.split('<template id="business-template">')[0];
 assert.equal(/<script[^>]+src="js\/(?:boot\.js|app\.js|app\/project\/project-store)/.test(before),false);
 const manifest=html.split('<template id="business-template">')[1].split('</template>')[0];assert.equal([...manifest.matchAll(/<script\b/g)].length,323);
 assert.equal(require('./check-index-load-groups').verifyIndex('index.html').errors.length,0);
});
console.log('Main login boundary: '+count+'/'+count+' PASS');
