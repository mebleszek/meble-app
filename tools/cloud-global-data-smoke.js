#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),clone=v=>JSON.parse(JSON.stringify(v));
function runtime(){
 const rows=new Map(),calls=[];const storage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>{calls.push(['set',k]);rows.set(k,String(v));},removeItem:k=>{calls.push(['remove',k]);rows.delete(k);}};
 const s={console,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,localStorage:storage,FC:{},setTimeout,clearTimeout};s.window=s;vm.createContext(s);
 const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s,{filename:file});
 for(const file of ['js/app/shared/constants.js','js/app/shared/storage.js','js/app/project/project-export-contract.js','js/app/cloud/global-data-contract.js','js/app/cloud/firebase-global-transport.js'])load(file);
 return {s,FC:s.FC,rows,calls,storage,load};
}
function model(){return {
 materials:[{id:'m1',name:'Synthetic white',materialType:'laminat',price:280,priceUnit:'sheet',hasGrain:false},{id:'e1',name:'PCV standard',materialType:'obrzeże',price:3,priceUnit:'mb'},{id:'e2',name:'PCV front',materialType:'obrzeże',price:5,priceUnit:'mb'}],
 manufacturers:['Synthetic maker'],categories:['Synthetic hinges'],suppliers:[{id:'s1',name:'Synthetic supplier',defaultDiscountPercent:5,active:true}],
 types:[{id:'t1',name:'Synthetic type',allowedCategories:['Synthetic hinges'],active:true}],
 technicalParams:[{id:'p1',category:'Synthetic hinges',key:'softClose',label:'Synthetic soft close',fieldType:'boolean',compareMode:'equal',options:[],active:true}],
 hardware:[{id:'h1',name:'Synthetic hinge',manufacturer:'Synthetic maker',hardwareCategory:'Synthetic hinges',hardwareUnit:'szt.',price:20,supplierId:'s1',technicalParams:{softClose:{value:true}},supplierPrices:[{supplierId:'s1',catalogPriceNet:10,catalogPriceGross:12.3,enteredPriceType:'net',priceDate:'2026-10-17',priceStatus:'current',useForQuote:true}],bundleItems:[]}],
 hardwareSettings:{defaultSupplierId:'s1',defaultVatRate:23,defaultMarkupPercent:20,defaultQuoteBase:'catalogGross',defaultPricingMode:'markup'},
 labor:[{id:'rate',name:'Synthetic workshop',category:'Stawki godzinowe',price:150,rateKey:'workshop',isHourlyRate:true},{id:'assembly',name:'Synthetic assembly',price:0,rateType:'workshop',pricingMode:'time',timeBlockHours:1}],workshopServices:[{id:'cut',name:'Synthetic cut',price:25}],
 stock:[{id:'sh1',material:'Korpus: laminat • Synthetic white',width:2800,height:2070,qty:3}],
 programDefaults:{version:2,general:{finishStandard:'',blendStandard:''},zones:{lower:{bodyColor:'Synthetic white'},middle:{},upper:{}},hardware:{drawerPreference:{kind:'system',systemKey:'test-system'}}},
 company:{company:{displayName:'Synthetic company',legalName:'Synthetic company',ownerName:'Synthetic owner',nip:'0000000000',regon:'000000000',addressLine:'Synthetic street',postalCode:'00-000',city:'Synthetic city',country:'Synthetic country',phone:'000000000',email:'synthetic@example.invalid',website:'example.invalid',notes:''},transport:{provider:'openrouteservice',profile:'driving-car',billingMode:'round_trip',roundingKm:1,minimumBillableKm:0,attribution:'synthetic'},meta:{updatedAt:'2026-10-17T00:00:00.000Z'}},
 businessCosts:{rows:[{id:'cost1',name:'Synthetic rent',amountNet:'1000',vatRate:23,billingPeriod:'monthly',active:true}],meta:{updatedAt:'2026-10-17T00:00:00.000Z'}}
};}
const tests=[],test=(n,f)=>tests.push([n,f]),code=c=>e=>e.code===c;
test('All 14 domains roundtrip exactly; stable identities, order, references and hashes survive',async()=>{
 const r=runtime(),c=r.FC.globalDataContract,m=model(),before=JSON.stringify(m),p=await c.pack('synthetic-owner',m);
 const out=await c.unpack('synthetic-owner',p.directory,p.records);assert.deepEqual(clone(out.model),m);assert.equal(JSON.stringify(m),before);assert.equal((await c.pack('synthetic-owner',clone(m))).directoryHash,p.directoryHash);
 const other=await c.pack('synthetic-other',m);assert.notEqual(other.directoryHash,p.directoryHash);assert.deepEqual(r.calls,[]);
});
test('A small catalog edit changes only one immutable record; order is explicit, not identity',async()=>{
 const r=runtime(),c=r.FC.globalDataContract,m=model(),a=await c.pack('synthetic-owner',m);m.materials[0].price=290;const b=await c.pack('synthetic-owner',m);
 assert.equal(b.records.filter(v=>!a.records.some(w=>w.hash===v.hash)).length,1);assert.equal(b.directory.materials[0].id,a.directory.materials[0].id);
 m.materials.reverse();const d=await c.pack('synthetic-owner',m);assert.notEqual(d.directoryHash,b.directoryHash);assert.deepEqual(d.records.map(r=>r.hash).sort(),b.records.map(r=>r.hash).sort());
});
test('RAW capture preserves five aliases; divergence refuses; known ORS credential never enters payload',async()=>{
 const r=runtime(),c=r.FC.globalDataContract,m=model();for(const [d,v]of Object.entries(m))r.rows.set(c.sources[d][0],JSON.stringify(d==='stock'?{sheets:v}:v));
 const company=clone(m.company);company.transport.apiKey='SYNTHETIC-CREDENTIAL-DO-NOT-TRANSFER';r.rows.set(c.sources.company[0],JSON.stringify(company));
 for(const d of ['suppliers','categories','types','technicalParams','hardwareSettings']){r.rows.set(c.sources[d][1],r.rows.get(c.sources[d][0]));r.rows.delete(c.sources[d][0]);}
 const before=[...r.rows],x=c.capture(r.storage,Object.keys(m));assert.deepEqual(clone(x.model),m);x.assertUnchanged();const p=await c.pack('synthetic-owner',x.model);assert.ok(!JSON.stringify(p).includes(company.transport.apiKey));assert.deepEqual([...r.rows],before);assert.deepEqual(r.calls,[]);
 r.rows.set(c.sources.categories[0],'[]');assert.throws(()=>c.capture(r.storage,Object.keys(m)),code('GLOBAL_ALIAS_CONFLICT'));
});
test('Unknown nested business data, secret fields, unresolved ownership and malformed values refuse',async()=>{
 const r=runtime(),c=r.FC.globalDataContract;
 for(const change of [m=>m.hardware[0].token='secret',m=>m.hardware[0].supplierPrices[0].apiKey='secret',m=>m.company.transport.apiKey='secret',m=>m.programDefaults.hardware.secret='secret',m=>m.materials[0].price=NaN,m=>m.stock[0].qty=-1,m=>m.materials.push(m.materials[0]),m=>m.hardware[0].technicalParams.unknown={value:'bad'},m=>m.businessCosts.rows[0].unknown='secret']){
  const m=model();change(m);assert.throws(()=>c.validate(m),e=>/^GLOBAL_/.test(e.code));
 }
 for(const d of ['fc_edge_v1','grain','drafts','backups','serviceOrders'])assert.throws(()=>c.capture(r.storage,[d]),code('GLOBAL_DOMAIN_UNSUPPORTED'));
 assert.throws(()=>c.validate({company:{...model().company,company:{displayName:'ya29.synthetic-token'}}}),code('GLOBAL_SECRET_FORBIDDEN'));
});
test('Missing dependencies, bundle cycles, duplicate parameter keys and invalid ranges refuse',()=>{
 const c=runtime().FC.globalDataContract;
 for(const change of [m=>m.suppliers=[],m=>delete m.categories,m=>m.hardware[0].bundleItems=[{itemId:'h1',qty:1}],m=>m.technicalParams.push({...m.technicalParams[0],id:'other'}),m=>m.hardware[0].technicalParams.softClose={value:'true'}]){const m=model();change(m);assert.throws(()=>c.validate(m),e=>/^GLOBAL_/.test(e.code));}
});
test('RAW missing/corrupt/failing storage and source changes never trigger any write',()=>{
 const r=runtime(),c=r.FC.globalDataContract;assert.throws(()=>c.capture(r.storage,['materials']),code('GLOBAL_SOURCE_MISSING'));r.rows.set('fc_sheet_materials_v1','{');assert.throws(()=>c.capture(r.storage,['materials']),code('GLOBAL_STORAGE_INVALID'));
 r.rows.set('fc_sheet_materials_v1',JSON.stringify(model().materials));const x=c.capture(r.storage,['materials']);r.rows.set('fc_sheet_materials_v1','[]');assert.throws(()=>x.assertUnchanged(),code('GLOBAL_SOURCE_CHANGED'));
 assert.throws(()=>c.capture({getItem(){throw Error('private value');}},['materials']),code('GLOBAL_STORAGE_UNAVAILABLE'));assert.deepEqual(r.calls,[]);
});
test('Corrupt/missing/extra/foreign record, swapped reference and oversize refuse',async()=>{
 const c=runtime().FC.globalDataContract,p=await c.pack('synthetic-owner',model());
 for(const change of [x=>x.records.pop(),x=>x.records[0].json+=' ',x=>x.records[0].ownerUid='foreign',x=>x.directory.materials[0].id='foreign',x=>x.records.push(x.records[0])]){const x=clone(p);change(x);await assert.rejects(c.unpack('synthetic-owner',x.directory,x.records),e=>/^GLOBAL_/.test(e.code));}
 const m=model();m.materials[0].note='ł'.repeat(65536);await assert.rejects(c.pack('synthetic-owner',m),code('GLOBAL_RECORD_TOO_LARGE'));
});
test('Native catalog/settings writers produce lossless supported records, without exporter normalization',async()=>{
 const r=runtime();for(const file of ['pricing/labor-catalog-definitions','pricing/labor-catalog','catalog/hardware-technical-params','catalog/hardware-catalog','catalog/hardware-catalog-seed-data','catalog/hardware-catalog-seeds','catalog/catalog-domain','catalog/catalog-migration','catalog/catalog-storage-policy','catalog/catalog-store','settings/program-defaults-store','settings/business-costs-store','settings/company-profile-store','material/magazyn'])r.load('js/app/'+file+'.js');
 const FC=r.FC,c=FC.globalDataContract;
 FC.catalogStore.savePriceList('materials',model().materials);FC.programDefaults.write(model().programDefaults);FC.companyProfile.write(model().company);FC.businessCosts.write(model().businessCosts);FC.magazyn.upsertSheet(model().stock[0]);
 const domains=Object.keys(c.sources),before=[...r.rows],n=r.calls.length;
 const captured=c.capture(r.storage,domains),packed=await c.pack('synthetic-owner',captured.model),restored=await c.unpack('synthetic-owner',packed.directory,packed.records);
 assert.deepEqual(clone(restored.model),clone(captured.model));captured.assertUnchanged();assert.deepEqual([...r.rows],before);assert.equal(r.calls.length,n);
});
test('Active edit session blocks RAW capture; native historical mirrors are not independent authorities',()=>{
 const r=runtime(),c=r.FC.globalDataContract,m=model();r.rows.set('fc_sheet_materials_v1',JSON.stringify(m.materials));r.rows.set('fc_materials_v1','[]');
 assert.throws(()=>c.capture(r.storage,['materials']),code('GLOBAL_ALIAS_CONFLICT'));r.rows.delete('fc_sheet_materials_v1');r.rows.set('fc_materials_v1',JSON.stringify(m.materials));
 assert.deepEqual(clone(c.capture(r.storage,['materials']).model.materials),m.materials);
 r.rows.set('fc_edit_session_v1','{}');assert.throws(()=>c.capture(r.storage,['materials']),code('GLOBAL_EDIT_SESSION_ACTIVE'));assert.deepEqual(r.calls,[]);
});
test('Documented global defaults v1 is preserved exactly without migrating or losing legacy preferences',async()=>{
 const c=runtime().FC.globalDataContract,m=model();m.programDefaults={version:1,materials:{bodyColor:'Synthetic white',frontMaterial:'laminat',frontColor:'Synthetic white',backMaterial:'HDF'},hardware:{hingesManufacturer:'Synthetic maker',drawerSystemManufacturer:'Synthetic maker',liftManufacturer:'',slidingSystemManufacturer:'',cargoManufacturer:'',accessoriesManufacturer:''}};
 const p=await c.pack('synthetic-owner',m);assert.deepEqual(clone((await c.unpack('synthetic-owner',p.directory,p.records)).model),m);
});
test('Record count, directory size and total bytes have independent fail-closed limits without trimming',async()=>{
 const c=runtime().FC.globalDataContract;
 for(const [count,note,longId]of [[1025,'',false],[400,'',true],[520,'x'.repeat(65500),false]]){
  const m=model();m.materials=Array.from({length:count},(_,i)=>({id:'m'+i+(longId?'z'.repeat(240):''),name:'Synthetic '+i,materialType:'laminat',price:1,priceUnit:'sheet',note}));
  await assert.rejects(c.pack('synthetic-owner',m),code('GLOBAL_SIZE_LIMIT'));assert.equal(m.materials.length,count);
 }
});
test('Valid recomputed hashes cannot legitimize a missing business dependency or an unknown nested field',async()=>{
 const c=runtime().FC.globalDataContract;
 for(const bad of [v=>v.supplierId='missing',v=>v.unknownBusinessField='synthetic']){
  const p=await c.pack('synthetic-owner',model()),ref=p.directory.hardware[0],r=p.records.find(r=>r.hash===ref.hash),envelope=JSON.parse(r.json);bad(envelope.value);
  r.json=c.canonical(envelope);r.byteLength=new TextEncoder().encode(r.json).length;r.hash=await c.sha(new TextEncoder().encode(r.json));ref.hash=r.hash;
  await assert.rejects(c.unpack('synthetic-owner',p.directory,p.records),e=>['GLOBAL_REFERENCE_MISSING','GLOBAL_UNKNOWN_FIELD'].includes(e.code));
 }
});
test('New boundaries remain absent from normal script manifests and do not initialize SDK',()=>{
 for(const name of ['index.html','js/main-login.js','tools/index-load-groups.js']){const content=fs.readFileSync(path.join(root,name),'utf8');assert.ok(!content.includes('firebase-global-transport.js'));assert.ok(!content.includes('global-data-contract.js'));assert.ok(!content.includes('cloud-data-session.js'));}
 const r=runtime();assert.deepEqual(r.calls,[]);assert.throws(()=>r.FC.firebaseGlobalTransport.fromConnection({}),/GLOBAL_DEPENDENCY_UNAVAILABLE/);
});
async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('CLOUD-3 global contracts: '+tests.length+'/'+tests.length+' PASS');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runtime,model};
