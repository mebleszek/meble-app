'use strict';
// Real native IndexedDB and the actual catalog/form/authority/committer chain.
// Synthetic loopback owner and form inputs; no Auth SDK or Firebase transport.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {buildCodeCatalogs}=require('./helpers/code-global-catalogs');
async function main(){
 const {model,context}=buildCodeCatalogs(),ids=context.FC.laborCatalogDefinitions.PDF_OPERATION_IDS;
 const old=structuredClone(model);old.labor=old.labor.filter(row=>!ids.includes(row.id));
 const {codeGlobalRows}=await import('../sync/global-code-rebuild-plan.mjs');
 const raw=codeGlobalRows(old,context.FC.globalDataContract);
 Object.assign(raw,{fc_projects_v1:'[{"id":"synthetic-project","investorId":"synthetic-investor","opaque":"KEEP_PROJECT"}]',fc_investors_v1:'[{"id":"synthetic-investor","opaque":"KEEP_INVESTOR"}]',fc_quote_snapshots_v1:'[{"opaque":"KEEP_FROZEN_OFFER","total":123.4567}]',fc_ui_v1:JSON.stringify({showPriceList:'quoteRates',editingId:'labor_body_h090'}),fc_edit_session_v1:null});
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><script>window.lfReady=true;</script>');return;}
  const file=path.resolve(root,'.'+pathname);
  if(!/^\/(sync\/[a-z.-]+\.mjs|js\/app\/[a-z/-]+\.js)$/.test(pathname)||!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'content-type':'text/javascript'});res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}
 });
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-labor-native-'));let browser;const external=[];
 const binding={name:'meble-lf-test-labor-catalog',ownerUid:'synthetic-owner',deviceId:'phone',instanceId:'one',initialize:true};
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
  async function open(initialize){
   browser=await openBrowserDevice({base},path.join(dir,'profile'));
   browser.onEvent(event=>{if(event.method==='Network.requestWillBeSent'&&!event.params.request.url.startsWith(base+'/'))external.push(event.params.request.url);});
   await browser.send('Network.enable');
   await browser.evaluate(`(async()=>{
    window.FC={};window.authorized=true;window.__FC_MAIN_ACCESS__={assert(){if(!authorized)throw Error('AUTH_ACCESS_REVOKED');},isLoading:()=>false};
    window.nativeGet=Storage.prototype.getItem;window.nativeSet=Storage.prototype.setItem;
    const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');
    window.store=await openLocalFirstStore({...${JSON.stringify(binding)},initialize:${initialize},indexedDB,locks:navigator.locks});
    if(${initialize}){
     const rows=${JSON.stringify(raw)};for(const [key,value]of Object.entries(rows))if(value!==null)localStorage.setItem(key,value);
     await store.initializeApplication(rows);
     const editor={deviceId:'phone',active:true,token:'synthetic-editor'};
     await store.apply({scope:'synthetic-pending',value:{exact:7.125},head:null,expectedVersion:0,editor});
     await store.commit({scope:'synthetic-pending',operationId:'uncertain-before-save',value:{exact:7.125},expectedVersion:1,editor,protectedRows:{original:'KEEP_PROTECTED'}});
     await store.transition('uncertain-before-save','queued','inflight',{expected:{generation:1}});
     await store.transition('uncertain-before-save','inflight','uncertain');
    }
    window.nativeRows=()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,nativeGet.call(localStorage,key)]));
    const image=await store.readApplication();
    // Legacy startup sees the verified image, while physical originals stay read-only.
    Storage.prototype.getItem=function(k){return this===localStorage&&Object.hasOwn(image.rows,k)?image.rows[k]:nativeGet.call(this,k);};
    Storage.prototype.setItem=function(k,v){if(this===localStorage&&Object.hasOwn(image.rows,k)){if(image.rows[k]!==String(v))throw Error('LF_LEGACY_BOOT_WRITE_REFUSED');return;}return nativeSet.call(this,k,v);};
    return true;
   })()`);
   for(const file of ['shared/utils','shared/constants','shared/storage','project/project-export-contract','cloud/global-data-contract','catalog/hardware-technical-params','catalog/hardware-catalog','catalog/hardware-catalog-seed-data','catalog/hardware-catalog-seeds','catalog/catalog-domain','catalog/catalog-migration','catalog/catalog-storage-policy','pricing/labor-catalog-definitions','pricing/labor-catalog','catalog/catalog-store'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
   await browser.evaluate(`(async()=>{
    Storage.prototype.getItem=nativeGet;Storage.prototype.setItem=nativeSet;
    const fc=FC,image=await store.readApplication(),contract=fc.globalDataContract;
    fc.catalogStore.adoptVerified(contract.capture({getItem:k=>k==='fc_edit_session_v1'?null:image.rows[k]??null},Object.keys(contract.schemas)).model);
    window.projectData={unsaved:'KEEP_RAM',form:{width:62}};window.uiState=JSON.parse(image.rows.fc_ui_v1);
    fc.session={active:false,durable:false,snapshot:null,trackKeyMutation(){}};fc.project={load:()=>structuredClone(projectData)};fc.uiState={get:()=>JSON.parse(localStorage.getItem('fc_ui_v1'))};
    fc.investorEditorState={hasUiLock:()=>false};fc.investorProjectRuntime={hasProjectDivergence:()=>false};fc.views={applyFromState(){}};fc.sections={update(){}};fc.infoBox={open(value){(window.notices ||= []).push(value);window.lastNotice=value;}};
    const {createApplicationCommitter}=await import('/sync/application-replication.mjs');
    const committer=createApplicationCommitter({store,globalContract:contract,localOnly:true});
    const {installOfflineEmulatorApplicationAuthority}=await import('/sync/application-authority.mjs');
    window.authority=await installOfflineEmulatorApplicationAuthority({window,store,ownerUid:${JSON.stringify(binding.ownerUid)},localOnly:true,beforeTransaction(){window.fenceChecks=(window.fenceChecks||0)+1;},commit:(kind,app)=>committer.commit(kind,app),checkpoint:(app,kind)=>committer.checkpoint(app,kind)});
    const {installApplicationWriteBoundary}=await import('/sync/application-write-boundary.mjs');
    installApplicationWriteBoundary({window,authority,localOnly:true});
    window.tables=async()=>new Promise((resolve,reject)=>{const q=indexedDB.open(${JSON.stringify(binding.name)});q.onerror=reject;q.onsuccess=()=>{const db=q.result,out={},tx=db.transaction(['control','replicas','protected','outbox'],'readonly');for(const name of tx.objectStoreNames){const get=tx.objectStore(name).getAll();get.onsuccess=()=>out[name]=get.result;}tx.oncomplete=()=>{db.close();resolve(out);};tx.onabort=reject;};});
    return true;
   })()`);
   for(const file of ['material/price-modal-context','material/price-modal-item-form','material/price-modal-persistence'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
   await browser.evaluate(`(()=>{const ctx=FC.priceModalContext;ctx.renderPriceModal=()=>{};ctx.confirmSave=async()=>window.acceptSave;ctx.isItemDirty=()=>window.dirty;ctx.getCurrentServiceDraft=()=>({...FC.catalogStore.getQuoteRates().find(r=>r.id==='labor_body_h090'),name:window.formName});window.openForm=async()=>{await authority.transaction('checkpoint',()=>{uiState.editingId='labor_body_h090';ctx.persistUi();ctx.runtimeState.itemModalOpen=true;return true;});};window.saveForm=()=>FC.applicationLifecycle.dispatch('price-item-save',()=>ctx.saveActivePriceItem());return true;})()`);
  }
  const proof=()=>browser.evaluate('(async()=>({tables:await tables(),native:nativeRows(),ram:projectData,catalog:FC.catalogStore.getQuoteRates(),rows:authority.rows(),form:FC.priceModalContext.runtimeState.itemModalOpen}))()');
  await open(true);await browser.gracefulClose();await open(false);let before=await proof();assert.equal(before.catalog.length,57);assert.equal(before.tables.outbox[0].phase,'uncertain');
  await browser.evaluate('window.dirty=false;window.acceptSave=true;saveForm()');let same=await proof();assert.equal(same.catalog.length,57);assert.equal(same.rows.fc_quote_rates_v1,before.rows.fc_quote_rates_v1);
  console.log('PASS unchanged Save only closes the form and does not activate missing PDF definitions');
  await browser.evaluate('openForm()');before=await proof();
  await browser.evaluate('window.dirty=true;window.acceptSave=false;window.formName="Synthetic edited corpus";saveForm()');same=await proof();assert.deepEqual(same,before);
  console.log('PASS refused confirmation preserves native RAW, all four stores, RAM, catalog and open form');
  await browser.evaluate(`window.acceptSave=true;window.originalTx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){const tx=originalTx.call(this,names,mode,...args);if(mode==='readwrite'&&Array.from(tx.objectStoreNames).includes('control')){window.abortObserved=true;IDBDatabase.prototype.transaction=originalTx;queueMicrotask(()=>tx.abort());}return tx;};saveForm()`);
  same=await proof();assert.equal(await browser.evaluate('window.abortObserved===true'),true,JSON.stringify(await browser.evaluate('window.notices')));assert.deepEqual(same.tables,before.tables);assert.deepEqual(same.native,before.native);assert.deepEqual(same.ram,before.ram);assert.deepEqual(same.catalog,before.catalog,'Aborted catalog save must roll back its in-memory cache too');assert.equal(same.form,true);
  console.log('PASS native IDB abort restores application, catalog cache, open form, RAW and uncertain outbox');
  await browser.evaluate(`window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='control'&&value?.key==='application'){window.quotaObserved=true;IDBObjectStore.prototype.put=originalPut;throw new DOMException('synthetic quota','QuotaExceededError');}return originalPut.call(this,value,...args);};saveForm()`);
  same=await proof();assert.equal(await browser.evaluate('window.quotaObserved===true'),true);assert.deepEqual(same.tables,before.tables);assert.deepEqual(same.native,before.native);assert.deepEqual(same.catalog,before.catalog);assert.deepEqual(same.ram,before.ram);assert.equal(same.form,true);
  console.log('PASS observed native quota failure rolls back the image/cache and preserves the form for retry');
  await browser.evaluate('window.authorized=false;saveForm()');await browser.evaluate('window.authorized=true;true');same=await proof();assert.deepEqual(same.tables,before.tables);assert.deepEqual(same.catalog,before.catalog);
  console.log('PASS revoked access prevents the catalog write');
  assert.equal(await browser.evaluate('saveForm()'),true,JSON.stringify(await browser.evaluate('({notices:window.notices,status:authority.status()})')));const after=await proof();assert.equal(after.catalog.length,120);assert.equal(after.form,false);assert.deepEqual(after.native,before.native);assert.deepEqual(after.ram,before.ram);
  for(const name of ['replicas','protected','outbox'])assert.deepEqual(after.tables[name],before.tables[name]);
  assert.deepEqual(after.tables.control.filter(row=>row.key!=='application'),before.tables.control.filter(row=>row.key!=='application'));
  assert.equal(after.tables.control.find(row=>row.key==='application').version,before.tables.control.find(row=>row.key==='application').version+1);
  for(const key of new Set([...Object.keys(before.rows),...Object.keys(after.rows)]))if(!['fc_quote_rates_v1','fc_services_v1','fc_ui_v1'].includes(key))assert.equal(after.rows[key],before.rows[key],key+' remains exact');
  for(const row of old.labor){const found=after.catalog.find(next=>next.id===row.id);for(const key of ['price','rateType','timeBlockHours','startHours','stepHours','startQty','quantitySource','quantityMode','pricingMode'])assert.equal(found[key],row[key],row.id+'/'+key);}
  for(const key of ['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1'])assert.equal(after.rows[key],before.rows[key]);
  assert.equal(after.rows.fc_quote_rates_v1,after.rows.fc_services_v1);
  assert.equal(await browser.evaluate('(()=>{const c=FC.globalDataContract;c.validateBundle(c.capture(localStorage,Object.keys(c.schemas)).model);return Object.keys(c.schemas).length;})()'),14);
  assert.equal(await browser.evaluate('FC.catalogStore.getQuoteRates().find(r=>r.id==="pdf_hood_corpus_adapt").timeBlockHours'),1);
  assert.equal(await browser.evaluate('(()=>{const rows=FC.catalogStore.getQuoteRates(),l=FC.laborCatalog;return ["labor_body_h090","pdf_hood_corpus_adapt","pdf_hood_prepare"].reduce((sum,id)=>sum+l.calculateDefinition(rows.find(r=>r.id===id),{quantity:1,hourlyRates:l.buildHourlyRates(rows)}).pricedHours*60,0);})()'),150);
  console.log('PASS confirmed existing Save persists 120 norms atomically; 14 domains validate; original RAW/projects/offers/three other stores remain exact');
  await browser.crash();await open(false);const restored=await proof();assert.deepEqual(restored.catalog,after.catalog);assert.equal(restored.rows.fc_quote_rates_v1,after.rows.fc_quote_rates_v1);assert.deepEqual(restored.native,after.native);
  for(const name of ['replicas','protected','outbox'])assert.deepEqual(restored.tables[name],after.tables[name]);assert.deepEqual(external,[]);
  console.log('PASS restart reopens the verified catalog and leaves the uncertain queue unchanged; zero external network requests');
 }finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
