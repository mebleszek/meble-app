'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {makeMiniDocument}=require('./app-dev-smoke-lib/mini-document');
const files=['js/app/shared/storage.js','js/app/service/service-order-store.js','js/app/optimizer/cut-optimizer.js','js/app/rozrys/rozrys-engine.js','js/app/service/cutting/service-cutting-common.js','js/app/service/cutting/service-cutting-rozrys.js','js/app/service/cutting/service-order-detail.js','js/app/service/service-orders.js'];
const source=file=>fs.readFileSync(path.join(process.env.MEBLE_SERVICE_INTEGRITY_SOURCE_ROOT||process.cwd(),file),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(seed){
 const raw=new Map(Object.entries(seed||{protected:'KEEP',outbox:'KEEP',fc_quote_snapshots_v1:'KEEP'}));
 let fault='',sequence=0,closed=0,config;const messages=[];
 const storage={getItem:key=>raw.get(key)??null,setItem(key,value){if(fault==='quota'){const e=Error('quota');e.name='QuotaExceededError';throw e;}raw.set(key,String(value));},removeItem:key=>raw.delete(key)};
 const document=makeMiniDocument();Object.getPrototypeOf(document.createElement('div')).closest=function(selector){for(let p=this;p;p=p.parentNode)if(selector.startsWith('.')&&p.classList.contains(selector.slice(1)))return p;return null;};
 const s={console,Date,Math,JSON,document,localStorage:storage,sessionStorage:storage,setTimeout:()=>0,clearTimeout(){},FC:{utils:{uid:()=> 'service-'+(++sequence)},infoBox:{open:cfg=>messages.push(cfg)},panelBox:{open:cfg=>{config=cfg;},close:()=>closed++},confirmBox:{ask:async()=>true}}};
 s.window=s;s.globalThis=s;vm.createContext(s);for(const file of files)vm.runInContext(source(file),s,{filename:file});
 const FC=s.FC,key=FC.serviceOrderStore.ORDER_KEY;
 return {s,FC,key,raw,messages,get config(){return config;},get closed(){return closed;},fault:value=>{fault=value;},snapshot:()=>Object.fromEntries(raw),reread:()=>fixture(Object.fromEntries(raw)).FC.serviceOrderStore.readAll()};
}
function seed(r){
 const cutting={materialMode:'client',materialName:'Oak',boardW:2800,boardH:2070,unit:'mm',kerf:4,edgeTrim:10,parts:[{id:'part-1',name:'Front',qty:2,along:700,across:300,thickness:18,materialName:'Oak',materialSymbol:'OAK',hasGrain:true,source:'pro100',extra:{keep:'PART'}}]};
 const generated=r.FC.serviceCuttingRozrys.generatePlan(cutting);assert.equal(generated.ok,true);assert.ok(generated.plan);cutting.plan=clone(generated.savedPlan);cutting.generatedAt=123;cutting.extra={keep:'CUTTING'};
 r.FC.serviceOrderStore.upsert({id:'service-1',title:'Before',clientName:'Client',customerName:'Client',address:'Address',orderType:'cutting',items:[{name:'Cut',qty:2,unitPrice:12,total:24,material:{keep:'ITEM'}}],total:24,createdAt:100,updatedAt:100,meta:{createdBy:'owner',extra:{keep:'META'}},extra:{keep:'ORDER'},cutting});
 r.FC.serviceOrderStore.upsert({id:'other',title:'Other',meta:{extra:{keep:'OTHER'}}});return clone(r.FC.serviceOrderStore.getById('service-1'));
}
function button(r,text){const el=Array.from(r.config.contentNode.querySelectorAll('button')).find(el=>el.textContent===text);assert.ok(el,'Missing button '+text);return el;}
async function click(el){for(const fn of el.__listeners.click||[])await fn({target:el,preventDefault(){},stopPropagation(){}});}
function edit(r){r.FC.serviceOrders.openEditor('service-1');const inputs=r.config.contentNode.querySelectorAll('input');inputs[0].value='After';inputs[0].dispatchEvent({type:'input'});return inputs;}
function editDetail(r){r.FC.serviceOrderDetail.open('service-1');const field=r.config.contentNode.querySelector('[data-field="name"]');field.value='Changed front';field.dispatchEvent({type:'input'});return field;}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('store refuses false, undefined and thrown writes without changing durable data',()=>{
 for(const failure of ['false','undefined','throw','quota']){
  const r=fixture();seed(r);const before=r.snapshot();
  if(failure==='quota')r.fault('quota');else r.FC.storage.setJSON=()=>{if(failure==='throw')throw Error('DENIED');return failure==='false'?false:undefined;};
  assert.throws(()=>r.FC.serviceOrderStore.writeAll([]));assert.throws(()=>r.FC.serviceOrderStore.upsert({id:'service-1',title:'Lost'}));assert.throws(()=>r.FC.serviceOrderStore.remove('service-1'));
  assert.deepEqual(r.snapshot(),before);assert.equal(r.reread().find(row=>row.id==='service-1').title,'Before');
 }
});
test('partial edit preserves generated layout, materials, items, metadata, unknown fields and other orders after reload',()=>{
 const r=fixture(),before=seed(r),other=clone(r.FC.serviceOrderStore.getById('other'));
 r.FC.serviceOrderStore.upsert({id:'service-1',title:'After'});
 const after=r.reread().find(row=>row.id==='service-1');assert.deepEqual(clone(after),{...before,title:'After'});assert.deepEqual(clone(r.FC.serviceOrderStore.getById('other')),other);
 after.cutting.parts[0].extra.keep='MUTATED';assert.equal(r.FC.serviceOrderStore.getById('service-1').cutting.parts[0].extra.keep,'PART');
});
test('basic editor updates canonical client name and preserves the complete order after reload',async()=>{
 const r=fixture(),before=seed(r),inputs=edit(r);inputs[1].value='New client';inputs[1].dispatchEvent({type:'input'});
 await click(button(r,'Zapisz'));assert.equal(r.closed,1);
 assert.deepEqual(clone(r.reread().find(row=>row.id==='service-1')),{...before,title:'After',clientName:'New client',customerName:'New client'});
});
test('missing, invalid, throwing, rejected and non-true confirmations deny save, delete and discard',async()=>{
 for(const confirm of [null,{}, {ask:true},{ask:()=>{throw Error('CONFIRM');}},{ask:()=>Promise.reject(Error('CONFIRM'))},{ask:async()=>false},{ask:async()=>undefined},{ask:async()=>({})},{ask:async()=> 'true'}]){
  for(const action of ['Zapisz','Usuń','Anuluj']){
   const r=fixture();seed(r);edit(r);r.FC.confirmBox=confirm;const before=r.snapshot();
   await click(button(r,action));assert.equal(r.closed,0,action);assert.deepEqual(r.snapshot(),before);assert.equal(await r.config.beforeClose(),false);
  }
 }
});
test('explicitly confirmed discard closes without saving',async()=>{
 const r=fixture();seed(r);edit(r);const before=r.snapshot();await click(button(r,'Anuluj'));assert.equal(r.closed,1);assert.deepEqual(r.snapshot(),before);
});
test('failed basic save keeps editor and dirty inputs, and retry persists once',async()=>{
 for(const failure of ['false','throw','reject']){
  const r=fixture();seed(r);const inputs=edit(r),before=r.snapshot(),original=r.FC.serviceOrderStore.upsert;
  if(failure==='false')r.fault('quota');else r.FC.serviceOrderStore.upsert=()=>{if(failure==='throw')throw Error('DENIED');return Promise.reject(Error('DENIED'));};
  await click(button(r,'Zapisz'));assert.equal(r.closed,0);assert.equal(inputs[0].value,'After');assert.deepEqual(r.snapshot(),before);assert.equal(r.messages.at(-1).title,'Nie zapisano');
  r.FC.confirmBox.ask=async()=>false;assert.equal(await r.config.beforeClose(),false);
  r.fault('');r.FC.serviceOrderStore.upsert=original;r.FC.confirmBox.ask=async()=>true;await click(button(r,'Zapisz'));assert.equal(r.closed,1);assert.equal(r.reread().find(row=>row.id==='service-1').title,'After');
 }
});
test('failed delete preserves the order, panel and dirty state; successful retry is durable',async()=>{
 for(const failure of ['false','throw','reject','undefined']){
  const r=fixture();seed(r);edit(r);const before=r.snapshot(),original=r.FC.serviceOrderStore.remove;
  r.FC.serviceOrderStore.remove=()=>{if(failure==='throw')throw Error('DENIED');if(failure==='reject')return Promise.reject(Error('DENIED'));return failure==='false'?false:undefined;};
  await click(button(r,'Usuń'));assert.equal(r.closed,0);assert.deepEqual(r.snapshot(),before);assert.equal(r.messages.at(-1).title,'Nie usunięto');
  r.FC.confirmBox.ask=async()=>false;assert.equal(await r.config.beforeClose(),false);
  r.FC.serviceOrderStore.remove=original;r.FC.confirmBox.ask=async()=>true;await click(button(r,'Usuń'));assert.equal(r.closed,1);assert.equal(r.reread().some(row=>row.id==='service-1'),false);assert.equal(r.reread().some(row=>row.id==='other'),true);
 }
});
test('unavailable authoritative store never writes through unconfirmed catalog fallback',async()=>{
 for(const action of ['Zapisz','Usuń']){
  const r=fixture();seed(r);edit(r);const before=r.snapshot();let fallbackCalls=0;
  r.FC.catalogStore={upsertServiceOrder(){fallbackCalls++;return {};},removeServiceOrder(){fallbackCalls++;return [];}};delete r.FC.serviceOrderStore;
  await click(button(r,action));assert.equal(fallbackCalls,0);assert.equal(r.closed,0);assert.deepEqual(r.snapshot(),before);
 }
});
test('detail write failure retains dirty state, layout, input and persisted data without success',async()=>{
 for(const failure of ['false','throw','reject','missing']){
  const r=fixture();seed(r);const input=editDetail(r),before=r.snapshot(),original=r.FC.serviceOrderStore.upsert;
  if(failure==='missing')delete r.FC.serviceOrderStore;else if(failure==='false')r.fault('quota');else r.FC.serviceOrderStore.upsert=()=>{if(failure==='throw')throw Error('DENIED');return Promise.reject(Error('DENIED'));};
  await click(button(r,'Zapisz'));assert.equal(r.closed,0);assert.equal(input.value,'Changed front');assert.deepEqual(r.snapshot(),before);assert.equal(r.messages.some(row=>row.title==='Zapisano'),false);
  r.FC.confirmBox=null;assert.equal(await r.config.beforeClose(),false);await click(button(r,'Wyjdź'));assert.equal(r.closed,0);
  if(failure!=='missing'){
   r.fault('');r.FC.serviceOrderStore.upsert=original;await click(button(r,'Zapisz'));assert.equal(r.messages.at(-1).title,'Zapisano');assert.equal(await r.config.beforeClose(),true);
   const saved=r.reread().find(row=>row.id==='service-1');assert.equal(saved.cutting.parts[0].name,'Changed front');assert.ok(saved.cutting.plan);assert.equal(saved.meta.extra.keep,'META');assert.equal(saved.cutting.extra.keep,'CUTTING');
  }
 }
});
test('detail close including title/escape guard denies missing, throw, rejection and Cancel',async()=>{
 for(const confirm of [null,{ask:()=>{throw Error('CONFIRM');}},{ask:()=>Promise.reject(Error('CONFIRM'))},{ask:async()=>false}]){
  const r=fixture();seed(r);editDetail(r);r.FC.confirmBox=confirm;const before=r.snapshot();
  assert.equal(await r.config.beforeClose({reason:'escape'}),false);assert.equal(await r.config.beforeClose({reason:'button'}),false);await click(button(r,'Wyjdź'));assert.equal(r.closed,0);assert.deepEqual(r.snapshot(),before);
 }
});
test('new-order denial and failed creation preserve draft; retry creates one durable record',async()=>{
 const r=fixture(),before=r.snapshot();r.FC.serviceOrders.openEditor();const input=r.config.contentNode.querySelector('input');input.value='New service';input.dispatchEvent({type:'input'});
 r.FC.confirmBox=null;await click(button(r,'Dodaj'));assert.equal(r.closed,0);assert.deepEqual(r.snapshot(),before);
 r.FC.confirmBox={ask:async()=>true};r.fault('quota');await click(button(r,'Dodaj'));assert.equal(r.closed,0);assert.deepEqual(r.snapshot(),before);assert.equal(input.value,'New service');
 r.fault('');await click(button(r,'Dodaj'));assert.equal(r.closed,1);const rows=r.reread();assert.equal(rows.length,1);assert.ok(rows[0].id);assert.equal(rows[0].title,'New service');
});
test('both editors retain dirty state until the write acknowledgement resolves',async()=>{
 for(const detail of [false,true]){
  const r=fixture();seed(r);if(detail)editDetail(r);else edit(r);const before=r.snapshot(),original=r.FC.serviceOrderStore.upsert;let acknowledge;
  r.FC.serviceOrderStore.upsert=payload=>new Promise(resolve=>{acknowledge=()=>resolve(original(payload));});
  const pending=click(button(r,'Zapisz'));await new Promise(setImmediate);assert.equal(typeof acknowledge,'function');assert.equal(r.closed,0);assert.deepEqual(r.snapshot(),before);assert.equal(r.messages.some(m=>m.title==='Zapisano'),false);
  r.FC.confirmBox.ask=async()=>false;assert.equal(await r.config.beforeClose(),false);acknowledge();await pending;
  if(detail){assert.equal(r.messages.at(-1).title,'Zapisano');assert.equal(await r.config.beforeClose(),true);}else assert.equal(r.closed,1);
 }
});

test('rapid double save executes one confirmation and one write across both pending phases',async()=>{
 const r=fixture();seed(r);edit(r);
 let allowConfirm, allowWrite, confirms=0,writes=0;
 const confirmGate=new Promise(resolve=>{allowConfirm=resolve;});
 const writeGate=new Promise(resolve=>{allowWrite=resolve;});
 const original=r.FC.serviceOrderStore.upsert;
 r.FC.confirmBox.ask=()=>{confirms++;return confirmGate;};
 r.FC.serviceOrderStore.upsert=async payload=>{writes++;await writeGate;return original(payload);};
 const first=click(button(r,'Zapisz')),second=click(button(r,'Zapisz'));
 await new Promise(setImmediate);
 assert.equal(confirms,1);assert.equal(writes,0);assert.equal(await r.config.beforeClose(),false);
 allowConfirm(true);await new Promise(setImmediate);
 assert.equal(writes,1);await click(button(r,'Zapisz'));assert.equal(writes,1);assert.equal(r.closed,0);
 allowWrite();await Promise.all([first,second]);
 assert.equal(r.closed,1);assert.equal(r.reread().find(row=>row.id==='service-1').title,'After');
});
test('rapid double delete executes one confirmation and one remove',async()=>{
 const r=fixture();seed(r);edit(r);
 let allowConfirm, allowWrite,confirms=0,writes=0;
 const confirmGate=new Promise(resolve=>{allowConfirm=resolve;});
 const writeGate=new Promise(resolve=>{allowWrite=resolve;});
 const original=r.FC.serviceOrderStore.remove;
 r.FC.confirmBox.ask=()=>{confirms++;return confirmGate;};
 r.FC.serviceOrderStore.remove=async id=>{writes++;await writeGate;return original(id);};
 const first=click(button(r,'Usuń')),second=click(button(r,'Usuń'));
 await new Promise(setImmediate);assert.equal(confirms,1);assert.equal(writes,0);
 allowConfirm(true);await new Promise(setImmediate);assert.equal(writes,1);
 await click(button(r,'Usuń'));assert.equal(writes,1);assert.equal(await r.config.beforeClose(),false);
 allowWrite();await Promise.all([first,second]);assert.equal(r.closed,1);
 assert.equal(r.reread().some(row=>row.id==='service-1'),false);
 assert.equal(r.reread().some(row=>row.id==='other'),true);
});
test('detail double save is single-flight; failed ACK retains dirty and permits retry',async()=>{
 const r=fixture();seed(r);const input=editDetail(r),original=r.FC.serviceOrderStore.upsert,before=r.snapshot();
 let release,writes=0;const gate=new Promise(resolve=>{release=resolve;});
 r.FC.serviceOrderStore.upsert=async payload=>{writes++;await gate;return false;};
 const first=click(button(r,'Zapisz')),second=click(button(r,'Zapisz'));
 await new Promise(setImmediate);assert.equal(writes,1);assert.equal(await r.config.beforeClose(),false);
 await click(button(r,'Zapisz'));assert.equal(writes,1);assert.equal(r.closed,0);
 release();await Promise.all([first,second]);assert.deepEqual(r.snapshot(),before);
 assert.equal(input.value,'Changed front');assert.equal(r.messages.at(-1).title,'Nie zapisano');
 r.FC.confirmBox.ask=async()=>false;assert.equal(await r.config.beforeClose(),false);
 r.FC.serviceOrderStore.upsert=original;await click(button(r,'Zapisz'));
 assert.equal(r.messages.at(-1).title,'Zapisano');
 assert.equal(r.reread().find(row=>row.id==='service-1').cutting.parts[0].name,'Changed front');
});
async function main(){let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`service-order-integrity: ${tests.length-failed}/${tests.length} PASS`);if(failed)throw Error('SERVICE_ORDER_INTEGRITY_FAILED');}
if(require.main===module)main().catch(()=>{process.exitCode=1;});
module.exports={main,files,source};
