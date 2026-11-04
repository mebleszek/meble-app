'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {buildCodeCatalogs}=require('./helpers/code-global-catalogs'),clone=v=>JSON.parse(JSON.stringify(v));
const tests=[],test=(name,fn)=>tests.push([name,fn]);
(async()=>{
 const first=buildCodeCatalogs(),{model:m,context:s,rawDefinitions:raw}=first,c=s.FC.globalDataContract,l=s.FC.laborCatalog;
 test('code-only deterministic generation covers 14 domains, forbids storage/cache/migration/clock/random and pins all code sources',()=>{
  const second=buildCodeCatalogs();assert.deepEqual(second.model,m);assert.deepEqual(second.provenance,first.provenance);assert.equal(Object.keys(m).length,14);assert.deepEqual(Object.keys(m).sort(),Object.keys(c.sources).sort());
  assert.equal(first.provenance.noStorage,true);assert.equal(first.provenance.noMigration,true);assert.equal(first.provenance.noCache,true);assert.equal(first.provenance.randomIds,false);
  assert.ok(first.provenance.sources.some(r=>r.path==='js/app/catalog/catalog-store.js'));assert.ok(first.provenance.sources.every(r=>/^[a-f0-9]{64}$/.test(r.sha256)));
  m.materials[0].price=999;assert.notEqual(buildCodeCatalogs().model.materials[0].price,999);m.materials[0].price=raw.materials[0].price;
  for(const key of ['storage','catalogStore','catalogMigration','catalogStoragePolicy'])assert.throws(()=>s.FC[key],/CODE_FACTORY_IO_FORBIDDEN/);
 });
 test('full validateBundle and runtime contracts, exact record IDs, dictionary closure, rates and quantity source references',async()=>{
  assert.doesNotThrow(()=>c.validateBundle(m));assert.equal(first.runtime.status,'VALIDATED');assert.equal(first.runtime.domains,14);assert.equal(first.runtime.hourlyRates,4);
  assert.deepEqual(first.validation.dependencies.map(d=>d.kind),['programDefaults']);
  assert.equal(m.materials.length,7);assert.equal(m.hardware.length,16);assert.equal(m.labor.length,57);assert.equal(m.categories.length,15);assert.equal(m.technicalParams.length,46);
  for(const domain of ['materials','hardware','labor','workshopServices'])assert.deepEqual(m[domain].map(r=>r.id),raw[domain].map(r=>r.id));
  const packed=await c.pack('synthetic-owner',m),decoded=await c.unpack('synthetic-owner',packed.directory,packed.records);assert.deepEqual(clone(decoded.model),m);
  const invalid=clone(m);for(const row of invalid.labor.slice(0,2)){row.rateKey='duplicate';row.rateCode='duplicate';}assert.throws(()=>c.validateBundle(invalid),e=>e.code==='GLOBAL_REFERENCE_CONFLICT');
  const ref=clone(m);ref.hardware[0].supplierId='synthetic-absent';assert.throws(()=>c.validateBundle(ref),e=>e.code==='GLOBAL_REFERENCE_MISSING');
 });
 test('neutral company survives runtime read/normalize without foreign identity; defaults/stock/costs contain no invented owner data',()=>{
  assert.equal(Object.values(m.company.company).some(Boolean),false);assert.deepEqual(m.stock,[]);assert.ok(m.businessCosts.rows.every(r=>r.amountNet===''));assert.equal(s.FC.businessCosts.monthlyTotals(m.businessCosts).filled,0);
  const before=JSON.stringify(m.company),normalized=s.FC.companyProfile.normalizeProfile(m.company);delete normalized.transport.apiKey;assert.equal(JSON.stringify(clone(normalized)),before);
  // A synthetic storage reader only, with a real program module. No WRITE.
  const isolated={};isolated.window=isolated;isolated.localStorage={getItem:()=>JSON.stringify(m.company),setItem(){throw Error('Forbidden WRITE');}};vm.createContext(isolated);vm.runInContext(fs.readFileSync('js/app/settings/company-profile-store.js','utf8'),isolated);
  assert.equal(Object.values(isolated.FC.companyProfile.read().company).some(Boolean),false);assert.equal(isolated.FC.companyProfile.companyAddress(m.company),'');
  const own=clone(m.company);own.company.displayName='SYNTHETIC_OWNER';assert.equal(isolated.FC.companyProfile.normalizeProfile(own).company.displayName,'SYNTHETIC_OWNER');
  assert.equal(s.FC.programDefaults.hasMeaningfulDefaults(m.programDefaults),false);assert.equal('apiKey' in m.company.transport,false);
 });
 test('every labor definition preserves current calculator results and exact approved rates/time norms/replacement mappings',()=>{
  const rates=l.buildHourlyRates(m.labor),codes=['workshop','assembly','specialist','helper'];assert.deepEqual(codes.map(k=>rates[k]),[150,250,300,80]);
  for(const [index,row]of raw.labor.entries())for(const quantity of [0,1,2,3,6,13])for(const volumeM3 of [0,0.4]){
   const options={quantity,volumeM3,hourlyRates:rates};assert.deepEqual(clone(l.calculateDefinition(row,options)),clone(l.calculateDefinition(m.labor[index],options)));
  }
  const calc=(id,q)=>l.calculateDefinition(m.labor.find(r=>r.id===id),{quantity:q,hourlyRates:rates});
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7);
  near(calc('labor_legs_install',4).pricedHours*60,9);near(calc('labor_shelves_adjustable',6).pricedHours*60,45);near(calc('labor_shelves_fixed',13).pricedHours*60,45);
  near(calc('project_design_parts',3).total,15);assert.equal(calc('labor_legs_install',0).total,0);
  assert.deepEqual(first.rules.laborReplacements,clone(s.FC.laborCatalogDefinitions.LABOR_REPLACEMENTS));
 });
 test('existing cabinet facts/cutlist/WYCENA agree with generated labor, including manual replacement suppression',()=>{
  const r=require('./wycena-labor-norms-smoke').fixture(),baseline=clone(r.details()),parts=clone(r.FC.cabinetCutlist.getCabinetCutList(r.cab,'kuchnia'));
  r.FC.catalogSelectors.getQuoteRates=()=>clone(m.labor);
  assert.deepEqual(clone(r.details()),baseline);assert.deepEqual(clone(r.FC.cabinetCutlist.getCabinetCutList(r.cab,'kuchnia')),parts);
  r.cab.laborItems=[{rateId:'labor_mount_hinge',qty:1}];const selected=clone(r.details());assert.ok(selected.some(row=>row.sourceKind==='automatic-suppressed'&&row.quantity===0));
 });
 test('material units/prices and hardware commercial values/quantities/technical replacement behavior come from current code',()=>{
  assert.deepEqual(m.materials,raw.materials);const h=s.FC.hardwareCatalog,tech=s.FC.hardwareTechnicalParams;
  for(const seed of raw.hardware){const item=m.hardware.find(r=>r.id===seed.id);assert.equal(item.catalogPriceGross,seed.catalogPriceGross);assert.equal(item.purchasePriceGross,seed.purchasePriceGross);assert.equal(item.price,h.resolveQuotePrice(item));assert.deepEqual(item.bundleItems,seed.bundleItems);assert.equal(item.hardwareUnit,seed.hardwareUnit);}
  for(const row of raw.technicalParams){const found=m.technicalParams.find(d=>d.category===row.category&&d.key===row.key);assert.ok(found);assert.equal(found.id,tech.normalizeDefinition(row).id);}
  const engine=s.FC.hardwareReplacementEngine;assert.ok(engine);assert.equal(first.runtime.existingProjectsChecked,false);
  const options={definitions:m.technicalParams,suppliers:m.suppliers,defaultVatRate:m.hardwareSettings.defaultVatRate};
  for(const source of m.hardware)for(const candidate of m.hardware){
   const compared=engine.compareItems(source,candidate,options),expected=engine.compareItems(h.normalizeAccessory(raw.hardware.find(r=>r.id===source.id),()=>{throw Error('No ID');},{...m.hardwareSettings,hardwareSuppliers:m.suppliers,hardwareTechnicalParams:m.technicalParams}),candidate,options);
   assert.equal(compared.compatible,expected.compatible);assert.equal(compared.score,expected.score);assert.deepEqual(clone(compared.failures),clone(expected.failures));
  }
 });
 test('real catalog boot over a staged code image preserves protected RAW and can adopt the complete verified bundle',async()=>{
  const {codeGlobalRows}=await import('../sync/global-code-rebuild-plan.mjs'),rows=codeGlobalRows(m,c);rows.fc_materials_v1=rows.fc_sheet_materials_v1;rows.fc_services_v1=rows.fc_quote_rates_v1;
  const before=JSON.stringify(rows),scope={FC:{},console,TextEncoder,crypto:require('node:crypto').webcrypto};scope.window=scope;scope.localStorage={getItem:key=>rows[key]??null,
   setItem(key,value){if(rows[key]!=null&&rows[key]!==String(value))throw Error('LF_LEGACY_BOOT_WRITE_REFUSED');if(rows[key]!=null)rows[key]=String(value);},removeItem(){throw Error('LF_LEGACY_BOOT_WRITE_REFUSED');}};
  vm.createContext(scope);const load=file=>vm.runInContext(fs.readFileSync('js/app/'+file+'.js','utf8'),scope);
  for(const file of ['shared/constants','shared/storage','project/project-export-contract','cloud/global-data-contract','catalog/hardware-technical-params','catalog/hardware-catalog','catalog/hardware-catalog-seed-data','catalog/hardware-catalog-seeds','catalog/catalog-domain','catalog/catalog-migration','catalog/catalog-storage-policy','pricing/labor-catalog-definitions','pricing/labor-catalog','catalog/catalog-store','settings/program-defaults-store','settings/business-costs-store','settings/company-profile-store'])load(file);
  const contract=scope.FC.globalDataContract;assert.doesNotThrow(()=>contract.validateBundle(contract.capture(scope.localStorage,Object.keys(contract.sources)).model));
  scope.FC.catalogStore.adoptVerified(m);assert.deepEqual(clone(scope.FC.catalogStore.getSheetMaterials()),m.materials);assert.deepEqual(clone(scope.FC.catalogStore.getQuoteRates()),m.labor);assert.deepEqual(clone(scope.FC.catalogStore.getAccessories()),m.hardware);
  assert.equal(Object.values(scope.FC.companyProfile.read().company).some(Boolean),false);assert.equal(JSON.stringify(rows),before);
  load('catalog/catalog-selectors');const legacy=clone(m);legacy.materials.find(r=>r.id==='m4').name='HDF biały 3 mm';const legacyBefore=JSON.stringify(legacy);
  scope.FC.catalogStore.adoptVerified(legacy);assert.deepEqual(clone(scope.FC.catalogStore.getSheetMaterials()),m.materials,'Historical catalog displays the approved name without changing its source');assert.equal(JSON.stringify(legacy),legacyBefore);assert.equal(JSON.stringify(rows),before);
 });
 test('approved HDF spelling resolves historical/current names identically in pricing and sync without choosing conflicting records',async()=>{
  let rows=clone(m.materials);const w={FC:{catalogStore:{getSheetMaterials:()=>rows},wycenaCoreUtils:{normalizeText:v=>String(v||'').trim()},projectExportContract:s.FC.projectExportContract},TextEncoder};w.window=w;
  vm.createContext(w);for(const file of ['catalog/catalog-selectors','cloud/global-data-contract','wycena/wycena-core-catalog'])vm.runInContext(fs.readFileSync('js/app/'+file+'.js','utf8'),w);
  const names=['HDF 3mm biała','HDF biały 3 mm'],{validateProjectDependencies}=await import('../sync/local-first-project.mjs');
  const check=(bundle,name)=>validateProjectDependencies({dependencies:()=>[{domain:'material',reference:name}]},w.FC.globalDataContract,{payload:{}},bundle);
  const original=m.materials.find(r=>r.id==='m4');assert.equal(original.name,names[0]);assert.equal(original.price,18);assert.equal(original.priceUnit,'m2');assert.equal(original.symbol,'HDF-3-BIALY');
  for(const storedName of names){
   const bundle=clone(m),item=bundle.materials.find(r=>r.id==='m4');item.name=storedName;item.price=123.456789;rows=bundle.materials;w.materials=rows;const before=JSON.stringify(bundle);
   for(const name of names){assert.equal(w.FC.catalogSelectors.findSheetMaterial(name).id,'m4');assert.equal(w.FC.wycenaCoreCatalog.materialPriceLookup(name).price,123.456789);assert.doesNotThrow(()=>check(bundle,name));}
   assert.equal(JSON.stringify(bundle),before,'Read resolution preserves prices, IDs, records and source names');
  }
  const ambiguous=clone(m);ambiguous.materials.push({...original,id:'synthetic-second-hdf',name:names[1],price:91.125});rows=ambiguous.materials;w.materials=rows;const before=JSON.stringify(ambiguous);
  for(const name of names){assert.equal(w.FC.catalogSelectors.findSheetMaterial(name),null);assert.equal(w.FC.wycenaCoreCatalog.materialPriceLookup(name),null);assert.throws(()=>check(ambiguous,name),e=>e.code==='LF_PROJECT_DEPENDENCY_MISSING');}
  assert.equal(JSON.stringify(ambiguous),before);assert.doesNotThrow(()=>check(ambiguous,'m4'));
  rows=clone(m.materials);w.materials=rows;for(const name of ['HDF 5mm biała','HDF 3mm czarna','synthetic unknown material'])assert.throws(()=>check(m,name),e=>e.code==='LF_PROJECT_DEPENDENCY_MISSING');
 });
 for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log(`CODE GLOBAL CATALOGS: ${tests.length}/${tests.length} PASS`);
})().catch(error=>{console.error(error.code||error.message||'CODE_FACTORY_TEST_FAILED');process.exitCode=1;});
