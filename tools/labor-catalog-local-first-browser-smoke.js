'use strict';
// Real native IndexedDB and the actual catalog/form/authority/committer chain.
// Synthetic loopback owner and form inputs; no Auth SDK or Firebase transport.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {buildCodeCatalogs}=require('./helpers/code-global-catalogs');
async function main(){
 const {model,context}=buildCodeCatalogs(),ids=context.FC.laborCatalogDefinitions.PDF_OPERATION_IDS;
 const old=structuredClone(model);old.labor=old.labor.filter(row=>!ids.includes(row.id)&&row.id!=='labor_daily_break'&&row.id!=='labor_delivery_loading');
 const legacy={};legacy.window=legacy;require('node:vm').createContext(legacy);
 require('node:vm').runInContext(require('node:child_process').execFileSync('git',['show','f29e8d3797108068130cfb73c3393a066e050c43:js/app/pricing/labor-catalog-definitions.js'],{encoding:'utf8'}),legacy);
 const correctedIds=['labor_carrying_cabinet','labor_carrying_disassembly','transport_distance_km'];
 for(const id of correctedIds){const i=old.labor.findIndex(row=>row.id===id);old.labor[i]=structuredClone(context.FC.laborCatalog.normalizeDefinition(legacy.FC.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS.find(row=>row.id===id)));}
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
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-labor-native-'));let browser,phase='setup';const external=[];
 const binding={name:'meble-lf-test-labor-catalog',ownerUid:'synthetic-owner',deviceId:'phone',instanceId:'one',initialize:true};
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
  let profile='profile',sourceRows=raw;
  async function open(initialize,fault=''){
   phase=profile+':open:'+initialize+':'+fault;
   browser=await openBrowserDevice({base},path.join(dir,profile));
   browser.onEvent(event=>{if(event.method==='Network.requestWillBeSent'&&!event.params.request.url.startsWith(base+'/'))external.push(event.params.request.url);});
   await browser.send('Network.enable');
   await browser.evaluate(`(async()=>{
    window.FC={};window.authorized=true;window.__FC_MAIN_ACCESS__={assert(){if(!authorized)throw Error('AUTH_ACCESS_REVOKED');},isLoading:()=>false};
    window.nativeGet=Storage.prototype.getItem;window.nativeSet=Storage.prototype.setItem;
    const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');
    window.store=await openLocalFirstStore({...${JSON.stringify(binding)},initialize:${initialize},indexedDB,locks:navigator.locks});
    if(${initialize}){
     const rows=${JSON.stringify(sourceRows)};for(const [key,value]of Object.entries(rows))if(value!==null)localStorage.setItem(key,value);
     await store.initializeApplication(rows);
     const editor={deviceId:'phone',active:true,token:'synthetic-editor'};
     await store.apply({scope:'synthetic-pending',value:{exact:7.125},head:null,expectedVersion:0,editor});
     await store.commit({scope:'synthetic-pending',operationId:'uncertain-before-save',value:{exact:7.125},expectedVersion:1,editor,protectedRows:{original:'KEEP_PROTECTED'}});
     await store.transition('uncertain-before-save','queued','inflight',{expected:{generation:1}});
     await store.transition('uncertain-before-save','inflight','uncertain');
    }
    window.nativeRows=()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,nativeGet.call(localStorage,key)]));
    window.tables=async()=>new Promise((resolve,reject)=>{const q=indexedDB.open(${JSON.stringify(binding.name)});q.onerror=reject;q.onsuccess=()=>{const db=q.result,out={},tx=db.transaction(['control','replicas','protected','outbox'],'readonly');for(const name of tx.objectStoreNames){const get=tx.objectStore(name).getAll();get.onsuccess=()=>out[name]=get.result;}tx.oncomplete=()=>{db.close();resolve(out);};tx.onabort=reject;};});
    const image=await store.readApplication();
    // Legacy startup sees the verified image, while physical originals stay read-only.
    Storage.prototype.getItem=function(k){return this===localStorage&&Object.hasOwn(image.rows,k)?image.rows[k]:nativeGet.call(this,k);};
    Storage.prototype.setItem=function(k,v){if(this===localStorage&&Object.hasOwn(image.rows,k)){if(image.rows[k]!==String(v))throw Error('LF_LEGACY_BOOT_WRITE_REFUSED');return;}return nativeSet.call(this,k,v);};
    return true;
   })()`);
   phase=profile+':classic-modules';
   for(const file of ['shared/utils','shared/constants','shared/storage','project/project-export-contract','project/business-project-contract','cloud/global-data-contract','catalog/hardware-technical-params','catalog/hardware-catalog','catalog/hardware-catalog-seed-data','catalog/hardware-catalog-seeds','catalog/catalog-domain','catalog/catalog-migration','catalog/catalog-storage-policy','pricing/labor-catalog-definitions','pricing/labor-catalog','catalog/catalog-store'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
   phase=profile+':install:'+fault;
   await browser.evaluate(`(async()=>{
    Storage.prototype.getItem=nativeGet;Storage.prototype.setItem=nativeSet;
    const fc=FC,image=await store.readApplication(),contract=fc.globalDataContract;
    fc.catalogStore.adoptVerified(contract.capture({getItem:k=>k==='fc_edit_session_v1'?null:image.rows[k]??null},Object.keys(contract.schemas)).model);
    window.projectData={unsaved:'KEEP_RAM',form:{width:62}};window.uiState=JSON.parse(image.rows.fc_ui_v1);
    fc.session={active:false,durable:false,snapshot:null,trackKeyMutation(){},resumeFromStorage(){this.active=true;this.durable=true;this.snapshot={};return true;}};fc.project={load:()=>structuredClone(projectData)};fc.uiState={get:()=>JSON.parse(localStorage.getItem('fc_ui_v1')),set(patch){const next={...JSON.parse(localStorage.getItem('fc_ui_v1')),...patch};localStorage.setItem('fc_ui_v1',JSON.stringify(next));return next;}};
    fc.investorEditorState={hasUiLock:()=>false};fc.investorProjectRuntime={hasProjectDivergence:()=>false};fc.views={applyFromState(){}};fc.sections={update(){}};fc.infoBox={open(value){(window.notices ||= []).push(value);window.lastNotice=value;}};
    const {createApplicationCommitter}=await import('/sync/application-replication.mjs');
    const committer=createApplicationCommitter({store,globalContract:contract,projectContract:fc.businessProjectContract,localOnly:true});
    const {installOfflineEmulatorApplicationAuthority}=await import('/sync/application-authority.mjs');
    window.startupBaseline={tables:await tables(),native:nativeRows()};
    if(${JSON.stringify(fault)}==='abort'){
     const native=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){const tx=native.call(this,names,mode,...args);if(mode==='readwrite'){window.startupFaultObserved=true;IDBDatabase.prototype.transaction=native;queueMicrotask(()=>tx.abort());}return tx;};
    }
    if(${JSON.stringify(fault)}==='quota'){
     const native=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='control'&&value?.key==='application'){window.startupFaultObserved=true;IDBObjectStore.prototype.put=native;throw new DOMException('synthetic quota','QuotaExceededError');}return native.call(this,value,...args);};
    }
    window.authority=await installOfflineEmulatorApplicationAuthority({window,store,ownerUid:${JSON.stringify(binding.ownerUid)},localOnly:true,authorize:async()=>{},async beforeTransaction(){if(${JSON.stringify(fault)}==='cas'){window.startupFaultObserved=true;const current=await store.readApplication();await store.checkpointApplication({expectedVersion:current.version,rows:current.rows});}window.fenceChecks=(window.fenceChecks||0)+1;if(${JSON.stringify(fault)}==='auth'){window.startupFaultObserved=true;window.authorized=false;}},commit:(kind,app)=>committer.commit(kind,app,app.rows.fc_current_project_id_v1),checkpoint:(app,kind)=>committer.checkpoint(app,kind)});
    const {installApplicationWriteBoundary}=await import('/sync/application-write-boundary.mjs');
    installApplicationWriteBoundary({window,authority,localOnly:true,ensureEditor:async()=>{}});
    return true;
   })()`);
   for(const file of ['material/price-modal-context','material/price-modal-item-form','material/price-modal-persistence'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
   await browser.evaluate(`(()=>{const ctx=FC.priceModalContext;window.actualFormDraft=ctx.getCurrentServiceDraft;ctx.renderPriceModal=()=>{};ctx.confirmSave=async()=>window.acceptSave;ctx.isItemDirty=()=>window.dirty;ctx.getCurrentServiceDraft=()=>({...FC.catalogStore.getQuoteRates().find(r=>r.id==='labor_body_h090'),name:window.formName,...(window.formScope?{billingScope:window.formScope,dailyStages:window.formStages}:{})});window.openForm=async()=>{await authority.transaction('checkpoint',()=>{uiState.editingId='labor_body_h090';ctx.persistUi();ctx.runtimeState.itemModalOpen=true;return true;});};window.saveForm=()=>FC.applicationLifecycle.dispatch('price-item-save',()=>ctx.saveActivePriceItem());return true;})()`);
  }
  const proof=()=>browser.evaluate('(async()=>({tables:await tables(),native:nativeRows(),ram:projectData,catalog:FC.catalogStore.getQuoteRates(),rows:authority.rows(),form:FC.priceModalContext.runtimeState.itemModalOpen}))()');
  if(!process.argv.includes('--scope-only')){
  await open(true);
  let bootProof=await proof(),baseline=await browser.evaluate('startupBaseline');
  assert.equal(baseline.tables.control.find(r=>r.key==='application').version,1);
  assert.equal(bootProof.tables.control.find(r=>r.key==='application').version,2);
  for(const name of ['replicas','protected','outbox'])assert.deepEqual(bootProof.tables[name],baseline.tables[name]);
  assert.equal(JSON.parse(baseline.native.fc_quote_rates_v1).length,57);
  assert.equal(bootProof.catalog.length,122);
  for(const row of old.labor){const actual=bootProof.catalog.find(r=>r.id===row.id);
   if(!correctedIds.includes(row.id)){assert.deepEqual(actual,row,'startup preserves every unrelated original field');continue;}
   const allowed=new Set(['rateType','note','minimumLevels','liftLevels','disassemblyWeightKg','unitPriceSource']);
   for(const key of Object.keys(row))if(!allowed.has(key))assert.deepEqual(actual[key],row[key],'factory correction preserves '+key);
   for(const key of Object.keys(actual))assert.ok(Object.hasOwn(row,key)||allowed.has(key),'no unapproved factory fields');
  }
  assert.equal(bootProof.catalog.find(r=>r.id==='labor_carrying_cabinet').rateType,'assembly');
  assert.equal(bootProof.catalog.find(r=>r.id==='transport_distance_km').unitPriceSource,'fuel');
  assert.equal(bootProof.rows.fc_quote_snapshots_v1,raw.fc_quote_snapshots_v1);

  console.log('PASS old 57-row profile automatically becomes 122 before use, with only approved exact factory corrections; private fields/offers/pending stores unchanged');
  await browser.evaluate(`(()=>{const cab={id:'quote-test',type:'wisząca',subType:'okap',width:60,height:82,depth:50,frontCount:0,backMaterial:'HDF',details:{}};
   FC.wycenaCoreUtils={clone:structuredClone,slug:v=>String(v).replace(/[^a-zA-Z0-9]/g,'_')};FC.wycenaCoreSource={project:()=>({kuchnia:{settings:{},cabinets:[cab]}}),selectedCabinets:()=>[{roomId:'kuchnia',roomLabel:'Synthetic Kitchen',cabinet:cab}],roomLabel:()=> 'Synthetic Kitchen'};
   FC.wycenaCoreOffer={};FC.wycenaCoreSelection={};FC.wycenaCoreCatalog={};FC.catalogSelectors={getQuoteRates:()=>FC.catalogStore.getQuoteRates()};FC.frontHardware={getCabinetFrontCutListForMaterials:()=>[],getDoorFrontPanelsForHinges:()=>[]};return true;})()`);
  for(const file of ['cabinet/cabinet-hardware-requirements','cabinet/cabinet-cutlist','pricing/work-quantity-sources','pricing/work-quantity-facts','wycena/wycena-core-labor'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
  assert.equal(await browser.evaluate(`FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']).flatMap(r=>r.details).filter(r=>['Skręcenie korpusu do 90 cm','Dostosowanie korpusu do okapu','Przygotowanie zabudowy okapu'].includes(r.name)).reduce((s,r)=>s+r.hours*60,0)`),150);
  console.log('PASS actual WYCENA reads the same persisted startup catalog: hood workshop 150 minutes before any Save');
  assert.equal(await browser.evaluate(`(()=>{for(const id of ['priceItemSaveBtn','priceItemExitBtn','priceItemCancelBtn','priceItemFooter']){const el=document.createElement('button');el.id=id;document.body.append(el);}const ctx=FC.priceModalContext;ctx.runtimeState.itemModalOpen=true;ctx.runtimeState.itemInitialSignature=JSON.stringify(actualFormDraft());ctx.updateItemActionState();return document.getElementById('priceItemSaveBtn').style.display==='none'&&document.getElementById('priceItemExitBtn').style.display!== 'none';})()`),true);
  console.log('PASS real form action-state keeps Save hidden when no item is edited');


  await browser.gracefulClose();await open(false);let before=await proof();assert.equal(before.catalog.length,122);assert.equal(before.tables.outbox[0].phase,'uncertain');
  await browser.evaluate('window.dirty=false;window.acceptSave=true;saveForm()');let same=await proof();assert.equal(same.catalog.length,122);assert.equal(same.rows.fc_quote_rates_v1,before.rows.fc_quote_rates_v1);
  console.log('PASS unchanged Save only closes the form and does not change the automatically completed catalog');
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
  assert.equal(await browser.evaluate('saveForm()'),true,JSON.stringify(await browser.evaluate('({notices:window.notices,status:authority.status()})')));const after=await proof();assert.equal(after.catalog.length,122);assert.equal(after.form,false);assert.deepEqual(after.native,before.native);assert.deepEqual(after.ram,before.ram);
  for(const name of ['replicas','protected','outbox'])assert.deepEqual(after.tables[name],before.tables[name]);
  assert.deepEqual(after.tables.control.filter(row=>row.key!=='application'),before.tables.control.filter(row=>row.key!=='application'));
  assert.equal(after.tables.control.find(row=>row.key==='application').version,before.tables.control.find(row=>row.key==='application').version+1);
  for(const key of new Set([...Object.keys(before.rows),...Object.keys(after.rows)]))if(!['fc_quote_rates_v1','fc_services_v1','fc_ui_v1'].includes(key))assert.equal(after.rows[key],before.rows[key],key+' remains exact');
  for(const row of before.catalog){const found=after.catalog.find(next=>next.id===row.id);for(const key of ['price','rateType','timeBlockHours','startHours','stepHours','startQty','quantitySource','quantityMode','pricingMode'])assert.equal(found[key],row[key],row.id+'/'+key);}
  for(const key of ['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1'])assert.equal(after.rows[key],before.rows[key]);
  assert.equal(after.rows.fc_quote_rates_v1,after.rows.fc_services_v1);
  assert.equal(await browser.evaluate('(()=>{const c=FC.globalDataContract;c.validateBundle(c.capture(localStorage,Object.keys(c.schemas)).model);return Object.keys(c.schemas).length;})()'),14);
  assert.equal(await browser.evaluate('FC.catalogStore.getQuoteRates().find(r=>r.id==="pdf_hood_corpus_adapt").timeBlockHours'),1);
  assert.equal(await browser.evaluate('(()=>{const rows=FC.catalogStore.getQuoteRates(),l=FC.laborCatalog;return ["labor_body_h090","pdf_hood_corpus_adapt","pdf_hood_prepare"].reduce((sum,id)=>sum+l.calculateDefinition(rows.find(r=>r.id===id),{quantity:1,hourlyRates:l.buildHourlyRates(rows)}).pricedHours*60,0);})()'),150);
  console.log('PASS confirmed existing Save persists 122 norms atomically; 14 domains validate; original RAW/projects/offers/three other stores remain exact');
  await browser.crash();await open(false);const restored=await proof();assert.deepEqual(restored.catalog,after.catalog);assert.equal(restored.rows.fc_quote_rates_v1,after.rows.fc_quote_rates_v1);assert.deepEqual(restored.native,after.native);
  for(const name of ['replicas','protected','outbox'])assert.deepEqual(restored.tables[name],after.tables[name]);assert.deepEqual(external,[]);
  console.log('PASS restart reopens the verified catalog and leaves the uncertain queue unchanged; zero external network requests');
  await browser.close();
  for(const fault of ['abort','quota','auth','cas']){
   profile='startup-'+fault;sourceRows=raw;
   await assert.rejects(open(true,fault),/LF_IDB|QuotaExceededError|AUTH_ACCESS_REVOKED|LF_APPLICATION_CONFLICT/);
   const failed=await browser.evaluate('(async()=>({seen:window.startupFaultObserved,tables:await tables(),native:nativeRows(),baseline:startupBaseline,catalog:FC.catalogStore.getQuoteRates()}))()');
   assert.equal(failed.seen,true);if(fault==='cas'){const expected=structuredClone(failed.baseline.tables);expected.control.find(row=>row.key==='application').version++;assert.deepEqual(failed.tables,expected);}else assert.deepEqual(failed.tables,failed.baseline.tables);assert.equal(failed.catalog.length,57);
   assert.deepEqual(failed.native,failed.baseline.native);
   phase=profile+':graceful';await browser.gracefulClose();await open(false);assert.equal((await proof()).catalog.length,122);await browser.close();
   console.log('PASS startup '+fault+' leaves the old image/queue/cache intact; next independent start completes defaults');
  }
  profile='private-records';sourceRows=structuredClone(raw);
  const privateRows=JSON.parse(sourceRows.fc_quote_rates_v1);
  for(const id of correctedIds)privateRows.find(row=>row.id===id).priceUserEditedAt='2026-11-08T00:00:00Z';
  privateRows.find(row=>row.id==='labor_rate_assembly').price=237.12345;
  privateRows.find(row=>row.id==='labor_body_h090').active=false;
  privateRows.push({...model.labor.find(row=>row.id==='pdf_door_adjust'),active:false});
  privateRows.push({...privateRows.find(row=>row.id==='labor_body_h090'),id:'synthetic-custom-norm',name:'Synthetic custom norm',timeBlockHours:0.75});
  sourceRows.fc_quote_rates_v1=JSON.stringify(privateRows);
  await open(true);let personal=await proof();assert.equal(personal.catalog.length,123);
  for(const row of privateRows)assert.deepEqual(personal.catalog.find(r=>r.id===row.id),row);
  const stored=personal.rows.fc_quote_rates_v1;await browser.gracefulClose();await open(false);
  personal=await proof();assert.equal(personal.rows.fc_quote_rates_v1,stored);assert.equal(new Set(personal.catalog.map(r=>r.id)).size,123);await browser.close();
  console.log('PASS private fractional rate, inactive defaults, private norm and 45-minute history remain exact and idempotent');
  }
  // A deployed 121-row catalog gains only the new combined loading/unloading rule.
  profile='existing-loading-catalog';sourceRows={...raw,fc_quote_rates_v1:JSON.stringify(model.labor.filter(row=>row.id!=='labor_delivery_loading')),fc_services_v1:null};
  await open(true);const loadingUpgrade=await proof(),loadingBaseline=await browser.evaluate('startupBaseline');
  const oldLoadingRows=JSON.parse(loadingBaseline.native.fc_quote_rates_v1),newLoadingRows=JSON.parse(loadingUpgrade.rows.fc_quote_rates_v1);
  assert.equal(oldLoadingRows.length,121);assert.equal(newLoadingRows.length,122);
  assert.deepEqual(newLoadingRows.slice(0,121),oldLoadingRows);
  assert.deepEqual(newLoadingRows[121],model.labor.find(row=>row.id==='labor_delivery_loading'));
  for(const table of ['outbox','replicas','protected'])assert.deepEqual(loadingUpgrade.tables[table],loadingBaseline.tables[table]);
  assert.deepEqual(loadingUpgrade.native,loadingBaseline.native);assert.deepEqual(loadingUpgrade.ram,{unsaved:'KEEP_RAM',form:{width:62}});
  const upgradedRaw=loadingUpgrade.rows.fc_quote_rates_v1;await browser.gracefulClose();await open(false);assert.equal((await proof()).rows.fc_quote_rates_v1,upgradedRaw);await browser.close();
  console.log('PASS existing 121-row catalog appends exactly one approved loading rule before use; prices, norms, native RAW/RAM and pending stores exact across cold restart');
  // New scope metadata follows the actual form -> catalog -> native IDB transaction.
  profile='scope-metadata';sourceRows=structuredClone(raw);await open(true);
  assert.equal(await browser.evaluate(`(()=>{for(const [id,value]of [['laborBillingScope','room'],['laborDailyStages','assembly']]){const select=document.createElement('select');select.id=id;const option=document.createElement('option');option.value=value;select.append(option);select.value=value;document.body.append(select);}const draft=actualFormDraft();return draft.billingScope==='room'&&draft.dailyStages==='assembly';})()`),true);
  await browser.evaluate("window.acceptSave=true;window.dirty=true;window.formName='Scoped body';window.formScope='room';window.formStages='assembly';openForm()");
  const scopeBefore=await proof();await browser.evaluate('saveForm()');
  const scoped=await proof(),savedScope=scoped.catalog.find(r=>r.id==='labor_body_h090');
  assert.equal(savedScope.billingScope,'room');assert.equal(savedScope.dailyStages,'assembly');
  assert.deepEqual(scoped.native,scopeBefore.native);assert.deepEqual(scoped.tables.outbox,scopeBefore.tables.outbox);assert.deepEqual(scoped.tables.replicas,scopeBefore.tables.replicas);assert.deepEqual(scoped.tables.protected,scopeBefore.tables.protected);assert.deepEqual(scoped.ram,scopeBefore.ram);
  await browser.gracefulClose();await open(false);assert.deepEqual((await proof()).catalog.find(r=>r.id==='labor_body_h090'),savedScope);
  // Render actual new views in this offline-capable browser, with synthetic calculation inputs.
  for(const file of ['ui/accordion-behavior','pricing/labor-work-plan','wycena/wycena-work-plan-view','quote/quote-offer-store'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
  assert.equal(await browser.evaluate(`(()=>{const root=document.createElement('div');document.body.append(root);FC.wycenaWorkPlanView.schedule(root,{schedule:{version:1,status:'READY',workshop:{minutes:480,totalMinutes:540,days:2},assembly:{minutes:360,totalMinutes:450,days:1},trips:1}});return root.textContent.includes('Warsztat: 8.00')&&root.textContent.includes('dni: 2')&&root.textContent.includes('Wyjazdy montażowe: 1');})()`),true);
  await browser.evaluate(`(()=>{const cab={id:'activity-cab',type:'wisząca',subType:'okap',width:60,height:82,depth:50,frontCount:0,backMaterial:'HDF',details:{}};FC.wycenaCoreUtils={clone:structuredClone,slug:v=>String(v).replace(/[^a-zA-Z0-9]/g,'_')};FC.wycenaCoreSource={project:()=>({kuchnia:{settings:{},cabinets:[cab]}}),selectedCabinets:()=>[{roomId:'kuchnia',roomLabel:'Kuchnia',cabinet:cab}],roomLabel:id=>id};FC.catalogSelectors={getQuoteRates:()=>FC.catalogStore.getQuoteRates()};FC.frontHardware={getCabinetFrontCutListForMaterials:()=>[],getDoorFrontPanelsForHinges:()=>[]};return true;})()`);
  for(const file of ['cabinet/cabinet-hardware-requirements','cabinet/cabinet-cutlist','pricing/work-quantity-sources','pricing/work-quantity-facts','wycena/wycena-core-offer','wycena/wycena-core-labor'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
  const readBefore=await proof();
  assert.deepEqual(await browser.evaluate(`(()=>{const root=document.createElement('div');document.body.append(root);FC.wycenaWorkPlanView.activities(root,'kuchnia');return {count:root.querySelectorAll('[data-billing-scope]').length,room:root.querySelector('[data-billing-scope="room"]').textContent.includes('Scoped body'),day:root.querySelector('[data-billing-scope="day"]').textContent.includes('Przerwa'),blocked:root.textContent.includes('Nie można obliczyć zakresu')};})()`),{count:3,room:true,day:true,blocked:false});
  // The production gallery's complete ROZRYS accordion, not a native summary triangle.
  await browser.evaluate(`(()=>{window.patternRoot=document.createElement('div');patternRoot.dataset.accordionGroup='true';document.body.append(patternRoot);FC.wycenaWorkPlanView.activities(patternRoot,'kuchnia');FC.wycenaWorkPlanView.schedule(patternRoot,{schedule:{status:'READY',workshop:{minutes:60,totalMinutes:90,days:1},assembly:{minutes:0,totalMinutes:0,days:0},trips:0}});return true;})()`);
  for(const css of ['rozrys-main','wywiad','quote-labor-picker'])await browser.evaluate(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(fs.readFileSync(path.join(root,'css/'+css+'.css'),'utf8'))};document.head.append(style);return true;})()`);
  assert.deepEqual(await browser.evaluate(`(()=>{const boxes=[...patternRoot.querySelectorAll('.rozrys-material-accordion')];return {count:boxes.length,native:patternRoot.querySelectorAll('summary').length,valid:boxes.every(box=>{const button=box.querySelector(':scope > .rozrys-material-accordion__head > button.rozrys-material-accordion__trigger'),body=box.querySelector(':scope > .rozrys-material-accordion__body'),arrow=button?.querySelector('.rozrys-material-accordion__chevron');return !!button&&button.type==='button'&&button.getAttribute('aria-expanded')==='false'&&body.hidden&&arrow.getAttribute('aria-hidden')==='true'&&getComputedStyle(arrow).minWidth==='40px'&&getComputedStyle(arrow,'::before').borderRightColor==='rgb(22, 101, 52)'&&!!button.querySelector('.rozrys-material-accordion__title-line1');})};})()`),{count:4,native:0,valid:true});
  await browser.evaluate(`(()=>{patternRoot.querySelector('button.rozrys-material-accordion__trigger').click();return true;})()`);
  assert.equal(await browser.evaluate(`patternRoot.querySelector('.rozrys-material-accordion').classList.contains('is-open')&&patternRoot.querySelector('button').getAttribute('aria-expanded')==='true'&&!patternRoot.querySelector('.rozrys-material-accordion__body').hidden`),true);
  await browser.evaluate(`(()=>{patternRoot.querySelectorAll('button.rozrys-material-accordion__trigger')[1].click();return true;})()`);
  // Wait for the existing 420 ms close animation, without changing its duration.
  await browser.evaluate(`new Promise(resolve=>setTimeout(resolve,550))`);
  assert.deepEqual(await browser.evaluate(`(()=>{const boxes=[...patternRoot.querySelectorAll('.rozrys-material-accordion')];return boxes.map(box=>({open:box.classList.contains('is-open'),expanded:box.querySelector('button').getAttribute('aria-expanded'),hidden:box.querySelector(':scope > .rozrys-material-accordion__body').hidden}));})()`),[{open:false,expanded:'false',hidden:true},{open:true,expanded:'true',hidden:false},{open:false,expanded:'false',hidden:true},{open:false,expanded:'false',hidden:true}]);
  await browser.evaluate(`(()=>{patternRoot.querySelectorAll('button.rozrys-material-accordion__trigger')[1].click();return true;})()`);
  await browser.evaluate(`new Promise(resolve=>setTimeout(resolve,550))`);
  assert.equal(await browser.evaluate(`patternRoot.querySelectorAll('.rozrys-material-accordion.is-open').length`),0);
  await browser.evaluate(`(()=>{patternRoot.querySelector('button.rozrys-material-accordion__trigger').focus();return true;})()`);
  for(const type of ['keyDown','keyUp'])await browser.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  assert.equal(await browser.evaluate(`patternRoot.querySelector('button').getAttribute('aria-expanded')==='true'&&!patternRoot.querySelector('.rozrys-material-accordion__body').hidden`),true);

  await browser.evaluate(fs.readFileSync(path.join(root,'js/tabs/czynnosci.js'),'utf8')+'\ntrue');
  assert.equal(await browser.evaluate(`(()=>{const node=document.createElement('div');document.body.append(node);FC.tabsCzynnosci.render({listEl:node,room:'kuchnia'});return node.textContent.includes('Warsztat:')&&node.textContent.includes('Montaż:')&&!node.textContent.includes('NaN');})()`),true);
  const readAfter=await proof();assert.deepEqual(readAfter.tables,readBefore.tables);assert.deepEqual(readAfter.native,readBefore.native);assert.deepEqual(readAfter.ram,readBefore.ram);
  console.log('PASS gallery appearance, animation/group close and four actual accordions; three room-scope accordions read the persisted catalog/shared calculator and never write RAW, native IDB or RAM');
  await browser.close();console.log('PASS scope/stage metadata persists through actual LOCAL-FIRST form commit and cold restart; native RAW, RAM, replicas/protected/outbox remain exact; actual schedule view renders');
  // Manual third-person hours use the existing owned-project path, including abort/retry.
  const synthetic=require('./project-selective-export-smoke').fixture(),document=await synthetic.build(),payload=document.document.payload;
  profile='helper-hours';sourceRows=structuredClone(raw);
  Object.assign(sourceRows,{fc_projects_v1:JSON.stringify([payload.project]),fc_investors_v1:JSON.stringify([payload.investor]),fc_quote_snapshots_v1:JSON.stringify([{id:'original-offer',project:{id:payload.project.id},investor:{id:payload.investor.id},frozen:123.4567}]),fc_current_project_id_v1:payload.project.id,fc_current_investor_v1:payload.investor.id});
  await open(true);
  for(const file of ['ui/accordion-behavior','quote/quote-offer-store','pricing/labor-work-plan','wycena/wycena-work-plan-view'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
  await browser.evaluate(`(()=>{FC.projectStore={getCurrentProjectId:()=>localStorage.getItem('fc_current_project_id_v1')};FC.investors={getCurrentId:()=>localStorage.getItem('fc_current_investor_v1')};window.helperInvalidations=0;FC.sessionNavigation={invalidateCalculationContext(){window.helperInvalidations++;}};window.helperRoot=document.createElement('div');document.body.append(helperRoot);FC.wycenaWorkPlanView.schedule(helperRoot,{schedule:{status:'READY',workshop:{minutes:60,totalMinutes:90,days:1},assembly:{minutes:0,totalMinutes:0,days:0},trips:0}});helperRoot.querySelector('.rozrys-material-accordion__trigger').click();window.saveHelper=async()=>{helperRoot.querySelector('input[data-helper-hours]').value='2.5';helperRoot.querySelector('input').dispatchEvent(new Event('input',{bubbles:true}));const button=helperRoot.querySelector('[data-helper-save]');button.click();const deadline=Date.now()+5000;while(button.disabled&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));if(button.disabled)throw Error('HELPER_TIMEOUT');return helperRoot.textContent;};})()`);
  assert.equal(await browser.evaluate("helperRoot.querySelector('[data-helper-save]').hidden"),true);
  const helperBefore=await proof();
  assert.match(await browser.evaluate(`(()=>{const native=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='control'&&value?.key==='application'){IDBObjectStore.prototype.put=native;throw new DOMException('synthetic quota','QuotaExceededError');}return native.call(this,value,...args);};return saveHelper();})()`),/Nie potwierdzono zapisu/);
  assert.equal(await browser.evaluate('window.helperInvalidations'),0);
  assert.deepEqual((await proof()).tables,helperBefore.tables);assert.equal(await browser.evaluate("helperRoot.querySelector('input').value"),'2.5');
  assert.match(await browser.evaluate('saveHelper()'),/Zapisano do nowej wyceny/);
  assert.equal(await browser.evaluate("helperRoot.querySelector('[data-helper-save]').hidden"),true);
  assert.equal(await browser.evaluate('window.helperInvalidations'),1);
  const helperSaved=await proof();assert.equal(JSON.parse(helperSaved.rows.fc_quote_offer_drafts_v1)[0].helperHours,2.5);
  assert.deepEqual(helperSaved.native,helperBefore.native);assert.deepEqual(helperSaved.ram,helperBefore.ram);assert.equal(helperSaved.rows.fc_quote_snapshots_v1,helperBefore.rows.fc_quote_snapshots_v1);
  for(const table of ['outbox','replicas','protected'])assert.deepEqual(helperSaved.tables[table],helperBefore.tables[table]);
  await browser.gracefulClose();await open(false);assert.equal(JSON.parse((await proof()).rows.fc_quote_offer_drafts_v1)[0].helperHours,2.5);
  for(const file of ['ui/accordion-behavior','ui/panel-box','quote/quote-offer-store','pricing/labor-work-plan','wycena/wycena-work-plan-view','wycena/wycena-tab-selection-render'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
  await browser.evaluate(`(()=>{FC.projectStore={getCurrentProjectId:()=>localStorage.getItem('fc_current_project_id_v1')};FC.investors={getCurrentId:()=>localStorage.getItem('fc_current_investor_v1')};window.serviceInvalidations=0;window.serviceRenders=0;window.acceptDiscard=false;FC.sessionNavigation={invalidateCalculationContext(){serviceInvalidations++;}};
  const h=(tag,attrs={})=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key==='class')node.className=value;else if(key==='text')node.textContent=value;else node.setAttribute(key,value);}return node;};
  window.serviceRoot=document.createElement('div');document.body.append(serviceRoot);window.renderServices=()=>{serviceRoot.replaceChildren();FC.wycenaTabSelectionRender.renderQuoteSelectionSection(serviceRoot,{}, {h,labelWithInfo:title=>h('label',{text:title}),getOfferDraft:()=>FC.quoteOfferStore.getCurrentDraft(),askConfirm:async()=>acceptDiscard,render(){serviceRenders++;renderServices();}});};renderServices();
  window.openServices=()=>serviceRoot.querySelector('[data-service-scope]').click();
  window.selectServices=value=>{for(const input of document.querySelectorAll('.panel-box input[data-service]')){input.checked=value;input.dispatchEvent(new Event('change',{bubbles:true}));}};
  window.saveServices=async()=>{const button=document.querySelector('.panel-box .btn-success');button.click();const deadline=Date.now()+5000;while(button.disabled&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));if(button.disabled)throw Error('SERVICE_SAVE_TIMEOUT');return document.querySelector('.panel-box')?.textContent||'CLOSED';};return true;})()`);
  phase='service-scope';await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  const serviceBefore=await proof();await browser.evaluate('openServices();true');
  if(process.env.MEBLE_UI_PREVIEW){
    await browser.evaluate(`(()=>{const meta=document.createElement('meta');meta.name='viewport';meta.content='width=device-width,initial-scale=1';document.head.append(meta);return true;})()`);
    await browser.send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:true});
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    for(const match of html.matchAll(/<link[^>]*href=["'](css\/[^"'?]+\.css)[^"']*["']/g))await browser.evaluate(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(fs.readFileSync(path.join(root,match[1]),'utf8'))};document.head.append(style);return true;})()`);
    const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.MEBLE_UI_PREVIEW,Buffer.from(shot.data,'base64'));
  }

  assert.equal(await browser.evaluate(`document.querySelectorAll('.panel-box input[data-service]:checked').length===3&&!document.querySelector('.panel-box .btn-success')`),true);
  await browser.evaluate('selectServices(false);true');
  assert.equal(await browser.evaluate(`!!document.querySelector('.panel-box .btn-success')&&!document.querySelector('.panel-box .btn-primary')`),true);
  await browser.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`);
  assert.equal(await browser.evaluate(`!!document.querySelector('.panel-box')`),true);assert.deepEqual((await proof()).tables,serviceBefore.tables);
  await browser.evaluate(`(async()=>{acceptDiscard=true;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(r=>setTimeout(r,0));return true;})()`);
  assert.equal(await browser.evaluate(`!!document.querySelector('.panel-box')`),false);assert.deepEqual((await proof()).tables,serviceBefore.tables);
  await browser.evaluate('openServices();selectServices(false);true');
  assert.match(await browser.evaluate(`(()=>{const native=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='control'&&value?.key==='application'){IDBObjectStore.prototype.put=native;throw new DOMException('synthetic quota','QuotaExceededError');}return native.call(this,value,...args);};return saveServices();})()`),/Nie potwierdzono zapisu/);
  assert.deepEqual((await proof()).tables,serviceBefore.tables);assert.equal(await browser.evaluate('serviceInvalidations'),0);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.panel-box input[data-service]:checked').length`),0);
  assert.equal(await browser.evaluate('saveServices()'),'CLOSED');assert.equal(await browser.evaluate('serviceInvalidations'),1);assert.equal(await browser.evaluate('serviceRenders'),1);
  const serviceSaved=await proof(),services={delivery:false,carrying:false,assembly:false};assert.deepEqual(JSON.parse(serviceSaved.rows.fc_quote_offer_drafts_v1)[0].services,services);
  assert.equal(JSON.parse(serviceSaved.rows.fc_quote_offer_drafts_v1)[0].helperHours,2.5);assert.equal(serviceSaved.rows.fc_quote_snapshots_v1,serviceBefore.rows.fc_quote_snapshots_v1);
  assert.deepEqual(serviceSaved.native,serviceBefore.native);assert.deepEqual(serviceSaved.ram,serviceBefore.ram);for(const table of ['outbox','replicas','protected'])assert.deepEqual(serviceSaved.tables[table],serviceBefore.tables[table]);
  // Revocation cannot reach the native application commit or clear the unsaved choices.
  await browser.evaluate('openServices();selectServices(true);window.authorized=false;true');
  assert.match(await browser.evaluate('saveServices()'),/Nie potwierdzono zapisu/);assert.deepEqual((await proof()).tables,serviceSaved.tables);assert.equal(await browser.evaluate(`document.querySelectorAll('.panel-box input[data-service]:checked').length`),3);
  await browser.gracefulClose();await open(false);
  // Existing startup performs exactly one no-data-change application checkpoint.
  const serviceAuthorized=await proof(),afterAuthRestart=structuredClone(serviceSaved.tables);afterAuthRestart.control.find(row=>row.key==='application').version++;
  assert.deepEqual(serviceAuthorized.tables,afterAuthRestart);assert.deepEqual(serviceAuthorized.native,serviceSaved.native);assert.deepEqual(serviceAuthorized.ram,serviceSaved.ram);
  for(const file of ['ui/panel-box','quote/quote-offer-store','pricing/labor-work-plan','wycena/wycena-work-plan-view'])await browser.evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
  await browser.evaluate(`(()=>{FC.projectStore={getCurrentProjectId:()=>localStorage.getItem('fc_current_project_id_v1')};FC.investors={getCurrentId:()=>localStorage.getItem('fc_current_investor_v1')};const root=document.createElement('div');document.body.append(root);FC.wycenaWorkPlanView.servicesLauncher(root,{}, {askConfirm:async()=>true});window.openServices=()=>root.querySelector('[data-service-scope]').click();window.selectServices=value=>{for(const input of document.querySelectorAll('.panel-box input[data-service]')){input.checked=value;input.dispatchEvent(new Event('change',{bubbles:true}));}};window.saveServices=async()=>{const button=document.querySelector('.panel-box .btn-success');button.click();const deadline=Date.now()+5000;while(button.disabled&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));if(button.disabled)throw Error('SERVICE_SAVE_TIMEOUT');return document.querySelector('.panel-box')?.textContent||'CLOSED';};return true;})()`);
  // A dialog opened for an earlier project cannot save to a newly selected project.
  await browser.evaluate(`openServices();selectServices(true);FC.projectStore.getCurrentProjectId=()=> 'synthetic-other-project';true`);
  assert.match(await browser.evaluate('saveServices()'),/Nie potwierdzono zapisu/);assert.deepEqual((await proof()).tables,serviceAuthorized.tables);
  await browser.gracefulClose();await open(false);const serviceRestart=await proof();const afterProjectRestart=structuredClone(serviceAuthorized.tables);afterProjectRestart.control.find(row=>row.key==='application').version++;assert.deepEqual(serviceRestart.tables,afterProjectRestart);assert.deepEqual(JSON.parse(serviceRestart.rows.fc_quote_offer_drafts_v1)[0].services,services);assert.equal(serviceRestart.rows.fc_quote_snapshots_v1,serviceBefore.rows.fc_quote_snapshots_v1);assert.deepEqual(serviceRestart.native,serviceBefore.native);assert.deepEqual(serviceRestart.ram,serviceBefore.ram);for(const table of ['outbox','replicas','protected'])assert.deepEqual(serviceRestart.tables[table],serviceBefore.tables[table]);await browser.close();
  console.log('PASS real quote-scope launcher/pattern panel: dirty-only Save, cancellation/Escape, native quota abort/retry, Auth revocation, owner-project change refusal and offline cold restart preserve RAW/RAM, frozen offers and all pending stores');
  console.log('PASS actual third-person input/project transaction abort retains form; retry and cold restart persist hours with unchanged RAM, physical RAW, frozen offers, replicas/protected/uncertain outbox');
  if(!process.argv.includes('--scope-only')){
  profile='durable-draft';sourceRows=structuredClone(raw);
  sourceRows.fc_edit_session_v1=JSON.stringify({schemaVersion:4,active:true,projectId:'synthetic-project',expectedOwnerKnown:true,snapshot:{fc_projects_v1:sourceRows.fc_projects_v1}});
  await open(true);const draft=await proof();assert.equal(draft.catalog.length,57);assert.equal(draft.rows.fc_edit_session_v1,sourceRows.fc_edit_session_v1);assert.deepEqual(draft.ram,{unsaved:'KEEP_RAM',form:{width:62}});
  console.log('PASS durable draft is resumed without changing its catalog baseline or forcing reload');
  await browser.close();profile='alias-conflict';sourceRows=structuredClone(raw);
  const conflicting=JSON.parse(sourceRows.fc_quote_rates_v1);conflicting[0].price+=1;sourceRows.fc_services_v1=JSON.stringify(conflicting);
  await assert.rejects(open(true),/GLOBAL_ALIAS_CONFLICT/);
  assert.deepEqual(await browser.evaluate('store.readApplication().then(value=>value.rows)'),sourceRows);
  console.log('PASS inconsistent existing labor aliases refuse startup without repair or partial default insertion');
  }
  assert.deepEqual(external,[]);
 }catch(error){error.message+=' ['+phase+']';throw error;}finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
