#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const ROOT = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const modules = [
  'js/app/shared/utils.js', 'js/app/shared/constants.js', 'js/app/shared/storage.js',
  'js/app/settings/program-defaults-store.js', 'js/app/settings/company-profile-store.js',
  'js/app/settings/business-costs-store.js', 'js/app/catalog/hardware-technical-params.js',
  'js/app/catalog/hardware-catalog.js', 'js/app/catalog/hardware-catalog-seed-data.js',
  'js/app/catalog/hardware-catalog-seeds.js', 'js/app/catalog/catalog-domain.js',
  'js/app/catalog/catalog-migration.js', 'js/app/catalog/catalog-storage-policy.js',
  'js/app/pricing/labor-catalog-definitions.js', 'js/app/pricing/labor-catalog.js',
  'js/app/catalog/catalog-store.js', 'js/app/settings/hourly-rates-store.js',
  'js/app/ui/data-settings-dom.js', 'js/app/ui/data-settings-company-view.js',
  'js/app/ui/data-settings-business-costs-view.js', 'js/app/ui/data-settings-hourly-rates-view.js', 'js/app/material/price-modal-context.js',
  'js/app/material/price-modal-persistence.js', 'js/app/material/price-modal-hardware-manufacturers.js',
  'js/app/material/price-modal-hardware-suppliers.js', 'js/app/material/price-modal-hardware-dictionaries.js',
  'js/app/service/cutting/service-pro100-import-ui.js',
];
function runtime(seed = {}, initialFailure){
  const rows = new Map(Object.entries(seed)), ops = [], messages = [];
  let failure = initialFailure || null, panel = null, closes = 0;
  const s = { console, document:makeMiniDocument(), crypto:require('node:crypto').webcrypto,
    setTimeout, clearTimeout, uiState:{ showPriceList:'materials', editingId:'' },
    localStorage:{
      getItem:key=>rows.get(key) ?? null,
      setItem(key, value){
        ops.push(['set',key]);
        if(failure && failure.key === key){
          if(failure.mode === 'throw') throw Object.assign(new Error('storage full'), { name:'QuotaExceededError' });
          if(failure.mode === 'noop') return;
          if(failure.mode === 'nativeFalse') return false;
        }
        rows.set(key, String(value));
      },
      removeItem(key){ ops.push(['remove',key]); rows.delete(key); },
      clear(){ throw Error('clear forbidden'); },
    },
  };
  s.window = s; s.globalThis = s; s.FC = {};
  vm.createContext(s);
  const load = file=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{filename:file});
  // Install fault injection before initialization, including a storage facade returning false.
  for(const file of modules){
    load(file);
    if(file === 'js/app/shared/storage.js'){
      const orig = s.FC.storage.setJSON;
      s.FC.storage.setJSON = function(key, value){
        if(failure && failure.key === key && failure.mode === 'false'){ ops.push(['rejected',key]); return false; }
        if(failure && failure.key === key && failure.mode === 'facadeThrow') throw Error('facade failed');
        return orig(key,value);
      };
    }
  }
  s.FC.infoBox = { open:cfg=>messages.push(cfg) };
  s.FC.panelBox = { open:cfg=>{panel=cfg;},close:()=>{closes++;} };
  return { s, FC:s.FC, rows, ops, messages, load,
    fail:(key,mode='throw')=>{failure={key,mode};}, retry:()=>{failure=null;},
    panel:()=>panel, closes:()=>closes,
  };
}
const tests = [], test = (name, fn)=>tests.push([name,fn]);
function rejects(fn){ assert.throws(fn, error=>error.code === 'GLOBAL_WRITE_FAILED' && !!error.key); }
const saves = [
  ['sheetMaterials','getSheetMaterials', r=>r.FC.catalogStore.savePriceList('materials',[{id:'user_material',name:'USER board',manufacturer:'USER',symbol:'U-1',price:999,materialType:'laminat'}])],
  ['accessories','getAccessories', r=>r.FC.catalogStore.savePriceList('accessories',[{id:'user_hw',name:'USER hinge',manufacturer:'USER',symbol:'UH',hardwareCategory:'Zawiasy',price:123}])],
  ['quoteRates','getQuoteRates', r=>r.FC.catalogStore.savePriceList('quoteRates',[{id:'user_service',name:'USER service',category:'Montaż',price:777}])],
  ['workshopServices','getWorkshopServices', r=>r.FC.catalogStore.savePriceList('workshopServices',[{id:'user_workshop',name:'USER workshop',category:'Cięcie',price:888}])],
  ['hardwareManufacturers','getHardwareManufacturers', r=>r.FC.catalogStore.saveHardwareManufacturers(['USER Maker'])],
  ['hardwareSuppliers','getHardwareSuppliers', r=>r.FC.catalogStore.saveHardwareSuppliers([{id:'user_supplier',name:'USER Supplier',defaultDiscountPercent:17}])],
  ['hardwareSettings','getHardwareSettings', r=>r.FC.catalogStore.saveHardwareSettings({defaultVatRate:8,defaultMarkupPercent:31})],
  ['hardwareCategories','getHardwareCategories', r=>r.FC.catalogStore.saveHardwareCategories(['USER Category'])],
  ['hardwareTypes','getHardwareTypes', r=>r.FC.catalogStore.saveHardwareTypes([{id:'user_type',name:'USER Type',allowedCategories:['Zawiasy'],active:true}])],
  ['hardwareTechnicalParams','getHardwareTechnicalParams', r=>r.FC.catalogStore.saveHardwareTechnicalParams([{category:'Zawiasy',key:'user_param',label:'USER Param',fieldType:'text',active:true}])],
];
for(const mode of ['false','throw','facadeThrow','noop']){
  test('Catalog '+mode+': old RAW, cache and compatibility keys survive for all 10 saves',()=>{
    for(const [logical,getter,save] of saves){
      const r=runtime(),key=r.FC.constants.STORAGE_KEYS[logical];
      const before=r.s.localStorage.getItem(key),cache=clone(r.FC.catalogStore[getter]());
      const legacy=r.FC.catalogStoragePolicy.LEGACY_KEYS[logical];
      if(legacy)r.s.localStorage.setItem(legacy,'["historical copy"]');
      const materials=r.s.localStorage.getItem('fc_materials_v1'),services=r.s.localStorage.getItem('fc_services_v1');
      r.ops.length=0;r.fail(key,mode);rejects(()=>save(r));
      assert.equal(r.s.localStorage.getItem(key),before);assert.deepEqual(clone(r.FC.catalogStore[getter]()),cache);
      assert.equal(r.s.localStorage.getItem('fc_materials_v1'),materials);assert.equal(r.s.localStorage.getItem('fc_services_v1'),services);
      if(legacy)assert.equal(r.s.localStorage.getItem(legacy),'["historical copy"]');
      assert.ok(!r.ops.some(op=>op[0]==='remove'));
      r.retry();assert.ok(save(r));assert.notEqual(r.s.localStorage.getItem(key),before);
    }
  });
}
test('Policy success confirms new primary before removing historical copy; primary wins on read',()=>{
  const r=runtime(),p=r.FC.catalogStoragePolicy,key='fc_hardware_suppliers_v1';
  r.s.localStorage.setItem(key,'["primary"]');r.s.localStorage.setItem('hardwareSuppliers','["legacy"]');
  assert.deepEqual(clone(p.readJSON(r.FC.storage,{},'hardwareSuppliers',[])),['primary']);
  r.ops.length=0;assert.deepEqual(clone(p.writeJSON(r.FC.storage,{},'hardwareSuppliers',['NEW'])),['NEW']);
  assert.equal(r.s.localStorage.getItem(key),'["NEW"]');assert.equal(r.s.localStorage.getItem('hardwareSuppliers'),null);
  assert.deepEqual(r.ops,[['set',key],['remove','hardwareSuppliers']]);
});
test('Unavailable storage is a failed write for catalogs and all settings',()=>{
  const r=runtime();delete r.s.localStorage;
  rejects(()=>r.FC.catalogStore.saveHardwareManufacturers(['USER']));
  assert.equal(r.FC.companyProfile.write({company:{displayName:'USER'}}),null);
  assert.equal(r.FC.businessCosts.write({rows:[{name:'USER'}]}),null);
  assert.equal(r.FC.programDefaults.write({general:{finishStandard:'USER'}}),null);
});
test('Catalog getters cannot mutate confirmed cache before saving',()=>{
  const r=runtime(),before=clone(r.FC.catalogStore.getSheetMaterials());
  r.FC.catalogStore.getSheetMaterials()[0].price=99999;
  assert.deepEqual(clone(r.FC.catalogStore.getSheetMaterials()),before);
});
test('Compatibility-copy failure is not success; cache reflects confirmed primary and survives restart',()=>{
  const r=runtime(),old=r.s.localStorage.getItem('fc_materials_v1');r.fail('fc_materials_v1');
  rejects(()=>saves[0][2](r));assert.equal(r.s.localStorage.getItem('fc_materials_v1'),old);
  assert.equal(r.FC.catalogStore.getSheetMaterials()[0].price,999);
  r.load('js/app/catalog/catalog-store.js');assert.equal(r.FC.catalogStore.getSheetMaterials().find(x=>x.id==='user_material').price,999);
  r.retry();saves[0][2](r);assert.equal(r.s.localStorage.getItem('fc_materials_v1'),r.s.localStorage.getItem('fc_sheet_materials_v1'));
});
test('Hourly rates failure cannot return ok:true; successful retry preserves non-hourly services',()=>{
  const r=runtime(),api=r.FC.hourlyRatesSettings,store=r.FC.catalogStore;
  saves[2][2](r);const before=r.s.localStorage.getItem('fc_quote_rates_v1'),rates=api.read();rates[0].price=456;
  for(const key of ['fc_quote_rates_v1','fc_services_v1']){
    r.fail(key,'false');assert.equal(api.write(rates).ok,false);
    if(key==='fc_quote_rates_v1')assert.equal(r.s.localStorage.getItem(key),before);
    r.retry();
  }
  // A failed primary attempt did not overwrite the old RAW.
  // The second attempt above may have confirmed the primary, while failing its compatibility copy.
  assert.ok(before.includes('USER service'));
  assert.equal(api.write(rates).ok,true);assert.equal(api.read()[0].price,456);
  assert.ok(store.getQuoteRates().some(x=>x.id==='user_service'&&x.price===777));
  for(const result of [false,null,undefined]){const orig=store.savePriceList;store.savePriceList=()=>result;assert.equal(api.write(rates).ok,false);store.savePriceList=orig;}
});
const settings = [
  ['companyProfile',{company:{displayName:'USER COMPANY',phone:'123456'},transport:{apiKey:'test-only'}}],
  ['businessCosts',{rows:[{id:'user_cost',name:'USER COST',amountNet:'987',vatRate:8,active:true}]}],
  ['programDefaults',{general:{finishStandard:'USER finish'},zones:{lower:{bodyColor:'USER board'}},hardware:{hingesManufacturer:'USER Maker'}}],
];
for(const [name,data] of settings){
  test(name+': success, exception, false/no-op, old value, reload and retry',()=>{
    const r=runtime(),api=r.FC[name],key=api.STORAGE_KEY;assert.ok(api.write(data));
    const old=r.s.localStorage.getItem(key),next=clone(data);
    if(name==='companyProfile')next.company.displayName='NEW';
    else if(name==='businessCosts')next.rows[0].name='NEW';else next.general.finishStandard='NEW';
    for(const mode of ['throw','noop','nativeFalse']){
      r.fail(key,mode);assert.equal(api.write(next),null);assert.equal(r.s.localStorage.getItem(key),old);
    }
    if(name==='programDefaults'){r.fail(key,'false');assert.equal(api.write(next),null);assert.equal(r.s.localStorage.getItem(key),old);}
    r.retry();assert.ok(api.write(next));assert.notEqual(r.s.localStorage.getItem(key),old);
    const confirmed=clone(api.read());r.load('js/app/settings/'+({companyProfile:'company-profile',businessCosts:'business-costs',programDefaults:'program-defaults'})[name]+'-store.js');
    assert.deepEqual(clone(r.FC[name].read()),confirmed);
  });
}
test('Startup and repeated migration preserve user materials, prices, suppliers and technical data',()=>{
  const r=runtime();for(const [, , save] of saves)save(r);
  r.FC.catalogStore.saveHardwareSuppliers([{id:'user_supplier',name:'USER Supplier',defaultDiscountPercent:19}]);
  const rate=r.FC.hourlyRatesSettings.read();rate[0].price=654;r.FC.hourlyRatesSettings.write(rate);
  for(let i=0;i<2;i++){
    r.load('js/app/catalog/catalog-store.js');const c=r.FC.catalogStore;
    assert.equal(c.getSheetMaterials().find(x=>x.id==='user_material').price,999);
    assert.equal(c.getAccessories().find(x=>x.id==='user_hw').price,123);
    assert.equal(c.getQuoteRates().find(x=>x.id==='user_service').price,777);
    assert.equal(r.FC.hourlyRatesSettings.read()[0].price,654);
    assert.equal(c.getHardwareSuppliers().find(x=>x.id==='user_supplier').defaultDiscountPercent,19);
    assert.ok(c.getHardwareTechnicalParams().some(x=>x.key==='user_param'));
    assert.ok(c.getHardwareTypes().some(x=>x.id==='user_type'));
  }
});
test('Failed startup migration retains legacy supplier and exact primary user catalog in RAM',()=>{
  const raw='[ {"id":"kept","name":"USER old","manufacturer":"USER","price":321,"materialType":"laminat"} ]';
  const r=runtime({'fc_sheet_materials_v1':raw,'hardwareSuppliers':'[{"id":"kept_supplier","name":"USER supplier","defaultDiscountPercent":13}]'}, {key:'fc_sheet_materials_v1',mode:'false'});
  assert.equal(r.s.localStorage.getItem('fc_sheet_materials_v1'),raw);
  assert.equal(r.FC.catalogStore.getSheetMaterials().length,1);assert.equal(r.FC.catalogStore.getSheetMaterials()[0].price,321);
  const failed=r.FC.catalogStore.migrateLegacy({preferStoredSplit:true});assert.equal(failed.ok,false);assert.ok(failed.failedKeys.includes('sheetMaterials'));
  // Failed migration of a loose historical key must never remove its only valid copy.
  const legacy='[{"id":"legacy_user","name":"USER supplier","defaultDiscountPercent":13}]';
  const l=runtime({hardwareSuppliers:legacy},{key:'fc_hardware_suppliers_v1',mode:'false'});
  assert.equal(l.s.localStorage.getItem('hardwareSuppliers'),legacy);assert.equal(l.s.localStorage.getItem('fc_hardware_suppliers_v1'),null);
  assert.ok(l.FC.catalogStore.getHardwareSuppliers().some(x=>x.id==='legacy_user'&&x.defaultDiscountPercent===13));
  l.retry();assert.equal(l.FC.catalogStore.migrateLegacy({preferStoredSplit:true}).ok,true);
  assert.equal(l.s.localStorage.getItem('hardwareSuppliers'),null);
  assert.ok(JSON.parse(l.s.localStorage.getItem('fc_hardware_suppliers_v1')).some(x=>x.id==='legacy_user'));
});
test('Startup does not replace corrupt primary or historical catalogs with starter defaults',()=>{
  for(const key of ['fc_sheet_materials_v1','fc_hardware_suppliers_v1','hardwareSuppliers']){
    const raw='USER DATA damaged JSON {';const r=runtime({[key]:raw});
    assert.equal(r.s.localStorage.getItem(key),raw);
    const result=r.FC.catalogStore.migrateLegacy({preferStoredSplit:true});assert.equal(result.ok,false);
    assert.equal(r.s.localStorage.getItem(key),raw);assert.ok(!r.ops.some(op=>op[0]==='set'&&op[1]===key));
  }
});
test('Company and costs UI keep the edited input on failure and report success only after retry',()=>{
  for(const [apiName,view] of [['companyProfile','dataSettingsCompanyView'],['businessCosts','dataSettingsBusinessCostsView']]){
    const r=runtime(),api=r.FC[apiName];api.write(settings.find(x=>x[0]===apiName)[1]);
    const key=api.STORAGE_KEY,old=r.s.localStorage.getItem(key),form=r.s.document.createElement('div');r.FC[view].render(form);
    const input=Array.from(form.querySelectorAll('input')).find(x=>x.getAttribute('type')!=='checkbox');
    input.value='USER edited draft';input.dispatchEvent({type:'input'});
    r.fail(key);form.querySelector('.data-settings-actions .btn-success').click();
    assert.equal(r.s.localStorage.getItem(key),old);assert.equal(input.value,'USER edited draft');
    assert.ok(r.messages.length);assert.ok(!r.messages.some(x=>x.title==='Zapisano'));
    r.retry();r.messages.length=0;form.querySelector('.data-settings-actions .btn-success').click();
    assert.equal(r.messages.at(-1).title,'Zapisano');assert.ok(r.s.localStorage.getItem(key).includes('USER edited draft'));
  }
});
test('Price-item save and deletion retain the modal/cache on failure; retry succeeds',async()=>{
  const r=runtime();saves[0][2](r);const ctx=r.FC.priceModalContext;let closed=0,rendered=0;
  r.s.uiState.editingId='user_material';ctx.getCurrentMaterialDraft=()=>({id:'user_material',name:'NEW board',manufacturer:'USER',materialType:'laminat',price:555});
  ctx.doClosePriceItemModal=()=>closed++;ctx.renderPriceModal=()=>rendered++;
  ctx.confirmDelete=()=>Promise.resolve(true);r.fail('fc_sheet_materials_v1','false');
  assert.equal(ctx.saveMaterialFromForm(),false);assert.equal(closed,0);assert.equal(rendered,0);
  assert.equal(await ctx.deletePriceItem({id:'user_material'}),false);assert.equal(closed,0);
  assert.equal(r.FC.catalogStore.getSheetMaterials()[0].price,999);
  r.retry();assert.equal(ctx.saveMaterialFromForm(),true);assert.equal(closed,1);assert.equal(r.FC.catalogStore.getSheetMaterials()[0].price,555);
});
test('Hourly-rate UI does not announce success or replace the form after a rejected write',()=>{
  const r=runtime(),form=r.s.document.createElement('div');r.FC.dataSettingsHourlyRatesView.render(form);
  const input=Array.from(form.querySelectorAll('input')).find(x=>x.getAttribute('inputmode')==='decimal');
  input.value='432';input.dispatchEvent({type:'input'});r.fail('fc_quote_rates_v1','false');
  form.querySelector('.data-settings-actions .btn-success').click();
  assert.ok(!r.messages.some(x=>x.title==='Zapisano'));assert.ok(r.messages.length);assert.equal(input.value,'432');
  r.retry();form.querySelector('.data-settings-actions .btn-success').click();
  assert.equal(r.messages.at(-1).title,'Zapisano');assert.ok(r.FC.hourlyRatesSettings.read().some(x=>x.price===432));
});
test('Dictionary modal does not close or declare a clean draft after a failed persistence',()=>{
  const r=runtime();r.FC.priceModalContext.openHardwareDictionariesModal();const body=r.panel().contentNode;
  r.fail('fc_hardware_categories_v1','false');body.querySelector('.btn-success').click();
  assert.equal(r.closes(),0);assert.ok(r.messages.length);
  r.retry();body.querySelector('.btn-success').click();assert.equal(r.closes(),1);
});
test('PRO100 material creation cannot mask a rejected catalog write',()=>{
  const r=runtime(),old=r.s.localStorage.getItem('fc_sheet_materials_v1');r.fail('fc_sheet_materials_v1','false');
  const rows=[{materialSymbol:'UNIQUE USER MATERIAL',thickness:18}];
  rejects(()=>r.FC.servicePro100Import.buildResolvedMaterialMap(rows,[]));assert.equal(r.s.localStorage.getItem('fc_sheet_materials_v1'),old);
  r.retry();assert.equal(r.FC.servicePro100Import.buildResolvedMaterialMap(rows,[]).size,1);
  assert.ok(r.FC.catalogStore.getSheetMaterials().some(x=>x.symbol==='UNIQUE USER MATERIAL'));
});
test('Manufacturer and supplier/settings dialogs remain open after a rejected save',()=>{
  for(const [open,key] of [['openHardwareManufacturersModal','fc_hardware_manufacturers_v1'],['openHardwareSuppliersModal','fc_hardware_suppliers_v1'],['openHardwareSettingsModal','fc_hardware_settings_v1']]){
    const r=runtime();r.FC.priceModalContext[open]();const body=r.panel().contentNode;const before=r.s.localStorage.getItem(key);
    r.fail(key,'false');body.querySelector('.btn-success').click();
    assert.equal(r.closes(),0);assert.equal(r.s.localStorage.getItem(key),before);assert.ok(r.messages.length);
    r.retry();body.querySelector('.btn-success').click();assert.equal(r.closes(),1);
  }
});
(async()=>{for(const [name,fn] of tests){await fn();console.log('PASS '+name);}console.log('Global data write safety: '+tests.length+'/'+tests.length+' PASS');})().catch(error=>{console.error(error);process.exitCode=1;});
