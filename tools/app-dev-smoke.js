const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

function createSandbox(){
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    Date, Math, JSON,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    Storage: SmokeStorage,
    document: makeMiniDocument(),
    structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
    crypto: require('crypto').webcrypto,
    __DEV_ASSETS__: {
      'index.html': fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8'),
      'dev_tests.html': fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8'),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {};
  return sandbox;
}

function loadSmokeFiles(sandbox, files){
  vm.createContext(sandbox);
  files.forEach((file)=>{
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(code, sandbox, { filename:file });
  });
  return sandbox;
}

function makeLoadedSandbox(){
  return loadSmokeFiles(createSandbox(), APP_DEV_SMOKE_FILES);
}

function makeSingleGroupReport(label, groupName, tests){
  const started = Date.now();
  const results = tests.map((test)=>{
    try{
      const ok = !!test.check();
      return { group:groupName, name:test.name, explain:test.explain || '', ok, message: ok ? '' : (test.message || 'Warunek smoke nie został spełniony') };
    }catch(error){
      return { group:groupName, name:test.name, explain:test.explain || '', ok:false, message:error && error.message ? error.message : String(error) };
    }
  });
  const passed = results.filter((row)=> row.ok).length;
  const failed = results.length - passed;
  return {
    label,
    total:results.length,
    passed,
    failed,
    durationMs:Date.now() - started,
    groups:[{ name:groupName, total:results.length, passed, failed, results }],
    results,
  };
}

function runProjectNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('PROJECT node smoke testy', 'Projekt ↔ Node smoke', [
    { name:'Project store jest dostępny', check:()=> !!(FC.projectStore && typeof FC.projectStore.readAll === 'function' && typeof FC.projectStore.writeAll === 'function') },
    { name:'Model projektu jest dostępny', check:()=> !!(FC.projectModel && typeof FC.projectModel.normalizeProjectData === 'function') },
    { name:'Bridge projektu jest dostępny', check:()=> !!(FC.project && typeof FC.project === 'object') },
    { name:'App core namespace jest wydzielony z app.js', check:()=> !!(FC.appCoreNamespace && typeof FC.appCoreNamespace.createAppCore === 'function') },
    { name:'App legacy bridges są wydzielone z app.js', check:()=> !!(FC.appLegacyBridges && FC.appLegacyBridges.installed === true) },
    { name:'Boot czeka dłużej na funkcję startową po świeżym wdrożeniu', explain:'Chroni przed fałszywym błędem boot-clean „Nie znaleziono funkcji startowej” na pierwszym wejściu, zanim wszystkie skrypty zakończą ładowanie.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/boot.js'), 'utf8');
      return src.includes("boot-clean-1.5")
        && src.includes('BOOT_MISSING_INIT_TIMEOUT_MS = 15000')
        && src.includes('loadSeen')
        && src.includes("window.addEventListener('load'")
        && !src.includes('tries > 60');
    } },
  ]);
}

function runDataNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('DATA node smoke testy', 'Dane ↔ Node smoke', [
    { name:'Storage facade jest dostępna', check:()=> !!(FC.storage && typeof FC.storage.getJSON === 'function' && typeof FC.storage.setJSON === 'function') },
    { name:'Backup store jest dostępny', check:()=> !!(FC.dataBackupStore && typeof FC.dataBackupStore.listBackups === 'function') },
    { name:'Audyt storage jest dostępny', check:()=> !!(FC.dataStorageAudit && typeof FC.dataStorageAudit.buildReport === 'function') },
  ]);
}

function runRysunekNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('RYSUNEK node smoke testy', 'Rysunek ↔ Node smoke', [
    { name:'Zakładka RYSUNEK jest załadowana', check:()=> !!(FC.tabsRysunek && typeof FC.tabsRysunek.renderDrawingTab === 'function') },
    { name:'Testy RYSUNKU są zarejestrowane', check:()=> !!(FC.rysunekDevTests && typeof FC.rysunekDevTests.runAll === 'function') },
    { name:'Layout state jest dostępny dla RYSUNKU', check:()=> !!(FC.layoutState && typeof FC.layoutState.getActiveSegment === 'function') },
  ]);
}

function runInvestorNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('INWESTOR node smoke testy', 'Inwestor ↔ Node smoke', [
    { name:'Investors store ma rozdzielone warstwy', check:()=> !!(FC.investors && typeof FC.investors.readAll === 'function' && typeof FC.investors.writeAll === 'function' && FC.investorsModel && typeof FC.investorsModel.normalizeInvestor === 'function' && FC.investorsLocalRepository && typeof FC.investorsLocalRepository.readStoredAll === 'function' && FC.investorsRecovery && typeof FC.investorsRecovery.recoverMissingInvestors === 'function') },
    { name:'Investor project ma rozdzielone repository/runtime/patches', check:()=> !!(FC.investorProjectRepository && typeof FC.investorProjectRepository.writeLegacySlotProject === 'function' && FC.investorProjectRuntime && typeof FC.investorProjectRuntime.setActiveProjectFromInvestor === 'function' && FC.investorProjectPatches && typeof FC.investorProjectPatches.patchProjectSave === 'function' && FC.investorProject && typeof FC.investorProject.init === 'function') },
    { name:'Investor project repository robi roundtrip legacy slotu', check:()=> { const repo = FC.investorProjectRepository; if(!(repo && typeof repo.writeLegacySlotProject === 'function' && typeof repo.readLegacySlotProject === 'function' && typeof repo.removeLegacySlot === 'function')) return false; const id = 'smoke_inv_project_slot'; const project = { schemaVersion:77, meta:{ smoke:true }, kuchnia:{ cabinets:[{ id:'cab_smoke' }], fronts:[], sets:[], settings:{} } }; repo.writeLegacySlotProject(id, project); const loaded = repo.readLegacySlotProject(id); repo.removeLegacySlot(id); return !!(loaded && loaded.meta && loaded.meta.smoke === true && loaded.kuchnia && Array.isArray(loaded.kuchnia.cabinets) && loaded.kuchnia.cabinets.length === 1 && !repo.readLegacySlotRaw(id)); } },
    { name:'Persistence inwestora jest dostępne', check:()=> !!(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function') },
    { name:'Room registry jest dostępne', check:()=> !!(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function') },
    { name:'Investor UI ma wydzielony render i status flow', check:()=> !!(FC.investorUiRender && typeof FC.investorUiRender.buildDetail === 'function' && typeof FC.investorUiRender.buildList === 'function' && FC.investorUiStatus && typeof FC.investorUiStatus.mountProjectStatusChoices === 'function' && FC.investorUI && typeof FC.investorUI.render === 'function') },
    { name:'Testy Inwestora mają wydzielone suity', check:()=> !!(FC.investorDevTests && typeof FC.investorDevTests.runAll === 'function' && FC.investorDevTests._debug && typeof FC.investorDevTests._debug.collectTests === 'function' && Array.isArray(FC.investorDevTestSuites) && FC.investorDevTestSuites.length >= 8 && FC.investorDevTests._debug.collectTests().length >= 26) },
  ]);
}

function runMaterialNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('MATERIAŁ node smoke testy', 'Materiał ↔ Node smoke', [
    { name:'Material registry jest dostępny', check:()=> !!(FC.materialRegistry && typeof FC.materialRegistry.getManufacturersByKind === 'function') },
    { name:'Edge store jest dostępny', check:()=> !!(FC.materialEdgeStore && typeof FC.materialEdgeStore.createEdgeStore === 'function') },
    { name:'Price modal API jest dostępne', check:()=> !!(FC.priceModal && typeof FC.priceModal.renderPriceModal === 'function') },
    { name:'Katalog okuć ma model producentów i pól handlowych', explain:'Pilnuje Etapu 1 okuć: producentów, jednostek, kategorii, źródła ceny i statusu.', check:()=> {
      const hw = FC.hardwareCatalog;
      const store = FC.catalogStore;
      if(!(hw && typeof hw.normalizeAccessory === 'function' && store && typeof store.getHardwareManufacturers === 'function' && typeof store.saveHardwareManufacturers === 'function')) return false;
      const normalized = hw.normalizeAccessory({ name:'Test zawias', manufacturer:'Blum', price:'8.50', hardwareCategory:'Zawiasy', hardwareUnit:'kpl.', purchasePrice:'6', markupPercent:'20', priceSource:'Bivert', priceUpdatedAt:'2026-05-04', status:'active' }, ()=> 'hw_test');
      return normalized.id === 'hw_test' && normalized.hardwareCategory === 'Zawiasy' && normalized.hardwareUnit === 'kpl.' && normalized.priceSource === 'Bivert' && normalized.priceUpdatedAt === '2026-05-04';
    } },
    { name:'Formularz akcesoriów ma pola okuć i panel producentów', explain:'Chroni UI katalogu okuć przed powrotem do prostego formularza nazwa+cena.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-manufacturers.js'), 'utf8');
      return html.includes('id="hardwareFormFields"') && html.includes('id="hardwareCategory"') && html.includes('id="hardwareUnit"') && html.includes('id="manageHardwareManufacturersBtn"') && src.includes('Producenci okuć') && src.includes('saveHardwareManufacturers');
    } },
    { name:'Katalog okuć ma dostawców, ustawienia i model ceny do wyceny', explain:'Pilnuje rozdzielenia kosztu firmy od ceny dla klienta: cena katalogowa, rabat, zakup po rabacie, narzut i cena do wyceny.', check:()=> {
      const hw = FC.hardwareCatalog;
      const store = FC.catalogStore;
      if(!(hw && store && typeof store.getHardwareSuppliers === 'function' && typeof store.getHardwareSettings === 'function')) return false;
      const row = hw.normalizeAccessory({ name:'Test cena', manufacturer:'Blum', catalogPriceGross:100, supplierDiscountPercent:15, quoteBase:'catalogGross', pricingMode:'markup', markupPercent:20, vatRate:23, hardwareCategory:'Zawiasy' }, ()=> 'hw_price_test', store.getHardwareSettings());
      return row.id === 'hw_price_test' && Math.abs(Number(row.purchasePriceGross) - 85) < 0.001 && Math.abs(Number(row.price) - 120) < 0.001 && Math.abs(Number(row.marginGross) - 35) < 0.001;
    } },
    { name:'Katalog okuć ma aplikacyjne filtry, sortowanie, dostawców i ustawienia', explain:'Chroni toolbar okuć: Filtry, Sortuj, Dostawcy i Ustawienia mają pozostać osobnymi oknami aplikacji.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const filters = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-filter-sort.js'), 'utf8');
      const suppliers = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-suppliers.js'), 'utf8');
      return ['openHardwareFiltersBtn','openHardwareSortBtn','manageHardwareSuppliersBtn','openHardwareSettingsBtn'].every((id)=> html.includes(id)) && filters.includes('Filtry okuć') && filters.includes('Sortuj okucia') && suppliers.includes('Dostawcy okuć') && suppliers.includes('Ustawienia cen okuć');
    } },
    { name:'Formularz okuć ma wrapper ceny prostej bez błędu startu', explain:'Chroni otwarcie Dodaj okucie przed ReferenceError formPriceWrapper po rozbudowie pól cen okuć.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-item-form.js'), 'utf8');
      return src.includes('function formPriceWrapper()') && src.includes("const priceWrap = formPriceWrapper();") && src.includes("priceWrap.style.display = cfg.formKind === 'accessory' ? 'none' : ''");
    } },
    { name:'Katalog okuć obsługuje zestawy ze składnikami', explain:'Pilnuje, że jednostka zestaw/kpl. ma skład z istniejących pozycji oraz dwa tryby ceny zakupu: własna cena zestawu albo suma składników.', check:()=> {
      const hw = FC.hardwareCatalog;
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const form = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-form.js'), 'utf8');
      const bundle = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-bundle.js'), 'utf8');
      if(!(hw && typeof hw.normalizeAccessory === 'function' && typeof hw.normalizeBundleItems === 'function' && typeof hw.isBundleUnit === 'function')) return false;
      const row = hw.normalizeAccessory({ id:'set1', name:'Zestaw', manufacturer:'Blum', hardwareUnit:'zestaw', bundleCostMode:'components', bundleItems:[{ itemId:'a', qty:2 }, { itemId:'set1', qty:1 }, { itemId:'a', qty:4 }] }, ()=> 'unused');
      return hw.isBundleUnit('zestaw') && row.bundleCostMode === 'components' && Array.isArray(row.bundleItems) && row.bundleItems.length === 1 && row.bundleItems[0].qty === 2 && html.includes('id="hardwareBundleFields"') && html.includes('id="hardwareBundleCostMode"') && bundle.includes('openPicker') && bundle.includes('priceModalHardwareBundle') && form.includes('clearPairIfSourceEmpty');
    } },
    { name:'Katalog okuć ma realne seedy Blum/GTV/Peka/Nomet/Rejs', explain:'Pilnuje, że etap seedów dodaje konkretne pozycje zamiast sztucznego placeholdera Zawias Blum.', check:()=> {
      const seeds = FC.hardwareCatalogSeeds;
      const store = FC.catalogStore;
      if(!(seeds && Array.isArray(seeds.ACCESSORY_SEEDS) && typeof seeds.mergeAccessorySeeds === 'function' && store && typeof store.getAccessories === 'function')) return false;
      const manufacturers = new Set(seeds.ACCESSORY_SEEDS.map((row)=> String(row && row.manufacturer || '')));
      const expected = ['Blum','GTV','Peka','Nomet','Rejs'];
      if(!expected.every((name)=> manufacturers.has(name))) return false;
      const merged = seeds.mergeAccessorySeeds([{ id:'a1', manufacturer:'Blum', symbol:'B1', name:'Zawias Blum', price:18 }]);
      if(merged.some((row)=> String(row && row.id || '') === 'a1' || String(row && row.name || '') === 'Zawias Blum')) return false;
      const accessories = store.getAccessories();
      const ids = new Set(accessories.map((row)=> String(row && row.id || '')));
      const required = ['hw_seed_blum_71b3550_173l6100','hw_seed_gtv_fchc_110_soft_euro','hw_seed_peka_snello_150_white','hw_seed_nomet_w2334m_150l_p22','hw_seed_rejs_comfort_box_plus_h69_500'];
      return required.every((id)=> ids.has(id)) && required.every((id)=> { const row = accessories.find((item)=> String(item && item.id || '') === id); return Number(row && row.purchasePriceGross) > 0 && Number(row && row.price) > 0 && String(row && row.priceUpdatedAt || '') === '2026-05-07'; });
    } },
    { name:'Katalog okuć ma import/eksport JSON i XLSX', explain:'Pilnuje, że etap import/export ma osobny boundary, przycisk w toolbarze oraz nie wymaga dopisywania ręcznego do localStorage poza catalogStore.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      const xlsx = FC.xlsxLite;
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const ui = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-import-export.js'), 'utf8');
      const resolver = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-import-resolver.js'), 'utf8');
      if(!(api && typeof api.buildImportPlan === 'function' && typeof api.applyImportPlan === 'function' && typeof api.exportJson === 'function' && typeof api.exportXlsx === 'function' && typeof api.findRequiredGaps === 'function')) return false;
      if(!(xlsx && typeof xlsx.makeWorkbookBlob === 'function' && typeof xlsx.readWorkbook === 'function')) return false;
      return Number(api.VERSION) >= 3 && html.includes('id="openHardwareImportExportBtn"') && html.includes('hardware-catalog-import-export.js') && html.includes('price-modal-hardware-import-resolver.js') && html.includes('price-modal-hardware-import-export.js') && ui.includes('Import / Eksport okuć') && ui.includes('puste wiersze są ignorowane') && ui.includes('Scal / aktualizuj') && ui.includes('Zastąp katalog') && ui.includes('makeFileSnapshot') && ui.includes('__fcFileSnapshot') && ui.includes('snapshot = await makeFileSnapshot(file)') && ui.includes("input.value = '';\n      await onFile(snapshot)") && resolver.includes('Ignoruj wszystko') && resolver.includes('Uzupełnij brakujące pola obowiązkowe');
    } },
    { name:'Eksport XLSX okuć ma formuły i listy wyboru', explain:'Chroni Excel jako roboczy szablon cennika: pola liczone mają formuły, a wybieralne pola mają data validation.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      const xlsx = FC.xlsxLite;
      if(!(api && api._debug && typeof api._debug.buildAccessoryRows === 'function' && typeof api._debug.accessoryValidations === 'function')) return false;
      if(!(xlsx && xlsx._debug && typeof xlsx._debug.validationsXml === 'function')) return false;
      const rows = api._debug.buildAccessoryRows([{ id:'hw_test_xlsx', status:'active', manufacturer:'Blum', symbol:'XLSX', name:'Test XLSX', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', vatRate:23, catalogPriceGross:100, supplierDiscountPercent:10, quoteBase:'catalogGross', pricingMode:'markup', markupPercent:20, bundleCostMode:'ownPrice' }]);
      const validations = api._debug.accessoryValidations({ accessories:[], manufacturers:['Blum'], suppliers:[] });
      const validationXml = xlsx._debug.validationsXml(validations);
      const headers = rows[0] || [];
      return rows.length >= 200
        && headers[0] === 'nazwa'
        && headers[headers.length - 1] === 'id'
        && rows[1][18] && String(rows[1][18].formula || '').includes('ROUND((IF(B2<>')
        && rows[1][21] && String(rows[1][21].formula || '').includes('manualPrice')
        && validationXml.includes('D2:D221')
        && validationXml.includes('E2:E221')
        && validationXml.includes('F2:F221')
        && validationXml.includes('Producenci!$A$2:$A$500');
    } },
    { name:'Import okuć obsługuje nowe wiersze bez ID i aktualizacje po ID', explain:'Chroni pracę z Excelem: nowe pozycje mogą mieć puste id, a istniejące aktualizują się po id bez duplikowania.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      const store = FC.catalogStore;
      if(!(api && store && typeof store.getAccessories === 'function')) return false;
      const before = store.getAccessories();
      const existing = before[0];
      const plan = api.buildImportPlan({ accessories:[
        Object.assign({}, existing, { name:String(existing.name || '') + ' TEST', price:77 }),
        { id:'', manufacturer:'Blum', symbol:'NEW-XLSX', name:'Nowa pozycja z Excela', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', catalogPriceNet:10, priceUpdatedAt:'2026-05-07' }
      ], manufacturers:['Blum'], suppliers:[], settings:{} }, { mode:'merge' });
      const gaps = api.findRequiredGaps({ accessories:[{ name:'Minimum', catalogPriceGross:10 }] });
      const emptyRows = api._debug.rowsToObjects([['nazwa','cena_netto','cena_brutto','jednostka','producent','kategoria','status','vat_proc'], ['', '', '', 'szt.', '', '', 'active', '23']], { kind:'accessories' });
      if(plan.errors.length) return false;
      const added = plan.next.accessories.find((row)=> String(row && row.symbol || '') === 'NEW-XLSX');
      const updated = plan.next.accessories.find((row)=> String(row && row.id || '') === String(existing && existing.id || ''));
      return plan.summary.added === 1 && plan.summary.updated === 1 && added && String(added.id || '').startsWith('hw_user_') && Number(added.catalogPriceGross) > 10 && updated && String(updated.name || '').endsWith('TEST') && gaps.length === 1 && gaps[0].gaps.includes('manufacturer') && gaps[0].gaps.includes('hardwareCategory') && gaps[0].gaps.includes('hardwareUnit') && emptyRows.length === 0;
    } },
    { name:'Dostawcy i ustawienia okuć używają kluczy fc_* objętych backupem', explain:'Chroni globalny backup: dane katalogu okuć nie mogą zostawać pod luźnymi kluczami hardwareSuppliers/hardwareSettings.', check:()=> {
      if(!(FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.hardwareSuppliers === 'fc_hardware_suppliers_v1' && FC.constants.STORAGE_KEYS.hardwareSettings === 'fc_hardware_settings_v1')) return false;
      if(!(FC.catalogStoragePolicy && FC.catalogStoragePolicy.BACKUP_KEYS && FC.catalogStoragePolicy.LEGACY_KEYS)) return false;
      const legacySandbox = createSandbox();
      legacySandbox.localStorage.setItem('hardwareSuppliers', JSON.stringify([{ id:'legacy_supplier', name:'Legacy Dostawca', defaultDiscountPercent:7, defaultVatRate:23, active:true }]));
      legacySandbox.localStorage.setItem('hardwareSettings', JSON.stringify({ defaultSupplierId:'legacy_supplier', defaultVatRate:23, defaultMarkupPercent:33, defaultQuoteBase:'purchaseGross', defaultPricingMode:'markup' }));
      loadSmokeFiles(legacySandbox, APP_DEV_SMOKE_FILES);
      const legacyFC = legacySandbox.FC || {};
      const suppliers = legacyFC.catalogStore && legacyFC.catalogStore.getHardwareSuppliers ? legacyFC.catalogStore.getHardwareSuppliers() : [];
      const settings = legacyFC.catalogStore && legacyFC.catalogStore.getHardwareSettings ? legacyFC.catalogStore.getHardwareSettings() : {};
      return suppliers.some((row)=> String(row && row.id || '') === 'legacy_supplier')
        && String(settings && settings.defaultSupplierId || '') === 'legacy_supplier'
        && legacySandbox.localStorage.getItem('fc_hardware_suppliers_v1')
        && legacySandbox.localStorage.getItem('fc_hardware_settings_v1')
        && legacySandbox.localStorage.getItem('hardwareSuppliers') == null
        && legacySandbox.localStorage.getItem('hardwareSettings') == null
        && legacyFC.dataStorageKeys && legacyFC.dataStorageKeys.isAppDataKey('fc_hardware_suppliers_v1')
        && legacyFC.dataStorageKeys.isAppDataKey('fc_hardware_settings_v1');
    } },
    { name:'Model robocizny cennika jest dostępny', check:()=> !!(FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' && typeof FC.laborCatalog.calculateDefinition === 'function') },
    { name:'Reguły montażu AGD są dostępne', check:()=> !!(FC.laborApplianceRules && typeof FC.laborApplianceRules.isMountingEnabled === 'function' && typeof FC.laborApplianceRules.setMountingMode === 'function') },
    { name:'Selektory katalogów zwracają stawki robocizny z catalogStore', explain:'Chroni WYCENĘ przed pustą robocizną po splicie katalogu na getPriceList.', check:()=> {
      const rows = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
      return Array.isArray(rows) && rows.some((row)=> String(row && row.id || '') === 'labor_body_h072') && rows.some((row)=> String(row && row.id || '') === 'labor_rate_workshop');
    } },
    { name:'Cennik robocizny ma aplikacyjne launchery wyboru zamiast natywnych selectów', explain:'Chroni formularz reguł robocizny przed systemowym pickerem Android/iOS.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-item-form.js'), 'utf8');
      const required = ['laborAutoRole','laborRateType','laborTimeBlockHours','laborQuantityMode','laborStartHours','laborStepHours','laborVolumeTimeMode'];
      return src.includes('mountLaborChoiceLaunchers') && src.includes('ensureLaborChoiceMount') && src.includes('selectEl.hidden = true') && src.includes('hideLaborUsageField') && required.every((id)=> src.includes(id));
    } },
  ]);
}

function runWycenaNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('WYCENA node smoke testy', 'Wycena ↔ Node smoke', [
    { name:'Publiczne API Wyceny jest dostępne', explain:'Szybki kontrakt dla app-dev-smoke bez uruchamiania ciężkich regresji statusów w Node.', check:()=> !!(FC.wycenaCore && FC.wycenaCoreSelection && FC.quoteSnapshotScope && FC.quoteSnapshotStore && FC.projectStatusSync && FC.wycenaTabDebug) },
    { name:'Wycena core ma rozdzielone platformowe warstwy', explain:'Pilnuje splitu wycena-core.js na utils/catalog/source/material-plan/offer/lines/labor/orchestrator.', check:()=> !!(FC.wycenaCoreUtils && FC.wycenaCoreCatalog && FC.wycenaCoreSource && FC.wycenaCoreMaterialPlan && FC.wycenaCoreOffer && FC.wycenaCoreLines && FC.wycenaCoreLabor && typeof FC.wycenaCore.collectQuoteData === 'function') },
    { name:'Wycena ma wewnętrzne rozbicie robocizny po szafkach', explain:'Pilnuje numerów szafek z WYWIADU i szczegółów kosztów robocizny tylko do podglądu wewnętrznego.', check:()=> !!(FC.wycenaCoreLabor && typeof FC.wycenaCoreLabor.collectCabinetLabor === 'function' && FC.wycenaTabPreview && typeof FC.wycenaTabPreview.renderLaborSection === 'function') },
    { name:'WYCENA ma aplikacyjny picker czynności zamiast długiej listy pól ilości', explain:'Chroni ręczne dodawanie robocizny przez osobne okno wyboru.', check:()=> !!(FC.wycenaLaborPicker && typeof FC.wycenaLaborPicker.open === 'function' && typeof FC.wycenaLaborPicker.normalizeCatalog === 'function') },
    { name:'Zakładka CZYNNOŚCI przejmuje ręczne czynności i podgląd szafek', explain:'Chroni przed powrotem dodawania robocizny do opcji WYCENY.', check:()=> !!(FC.tabsCzynnosci && typeof FC.tabsCzynnosci.render === 'function' && typeof FC.tabsCzynnosci.buildCabinetRows === 'function' && FC.wycenaTabManualLabor && typeof FC.wycenaTabManualLabor.renderManualLaborEditor === 'function') },
    { name:'WYCENA nie renderuje już akordeonu ręcznych czynności', explain:'Czynności mają mieszkać w zakładce CZYNNOŚCI, nie w opcjach WYCENY.', check:()=> { const src = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-tab-shell.js'), 'utf8'); return !src.includes('renderManualLaborEditor(card, ctx)'); } },
    { name:'Picker czynności używa standardowego panelBox', explain:'Chroni okno Dodaj czynności przed obcym pływającym układem i przyklejonym paskiem akcji.', check:()=> { const src = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-labor-picker.js'), 'utf8'); const css = fs.readFileSync(path.join(process.cwd(), 'css/quote-labor-picker.css'), 'utf8'); return src.includes('FC.panelBox.open') && src.includes('panel-box-form quote-labor-picker-form') && src.includes('panel-box-form__footer quote-labor-picker__footer') && css.includes('.quote-labor-picker-panel') && !css.includes('padding:12px 18px 16px'); } },
    { name:'Wycena wylicza robociznę szafki z katalogu', explain:'Chroni sekcję Robocizna — szafki przed pustym wynikiem mimo istniejących szafek.', check:()=> {
      const previousProject = sandbox.projectData;
      try{
        sandbox.projectData = { schemaVersion:9, kuchnia:{ cabinets:[{ id:'cab_labor_smoke', width:60, height:94.2, depth:36, type:'wisząca', subType:'okap', details:{ shelves:2 }, laborItems:[{ rateId:'labor_hole_fi60', qty:1 }] }], fronts:[], sets:[], settings:{} } };
        const rows = FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']);
        return Array.isArray(rows) && rows.length === 1 && Number(rows[0] && rows[0].total || 0) > 0 && Number(rows[0] && rows[0].cabinetNumber || 0) === 1 && Array.isArray(rows[0].details) && rows[0].details.length >= 2;
      }finally{ sandbox.projectData = previousProject; }
    } },
    { name:'Gabaryt nie jest liczony podwójnie przy gabarytoczasie', explain:'Jeśli reguła ma gabarytoczas, dopłata PLN/m³ jest ignorowana, żeby ten sam gabaryt nie podbijał ceny dwa razy.', check:()=> {
      const calc = FC.laborCatalog.calculateDefinition({
        id:'smoke_volume_guard',
        name:'Smoke gabaryt',
        category:'Korpusy',
        price:0,
        autoRole:'none',
        rateType:'workshop',
        timeBlockHours:1,
        defaultMultiplier:1,
        quantityMode:'none',
        volumePricePerM3:50,
        volumeTimeMode:'perM3',
        volumeTimePerM3:1,
        active:true
      }, { quantity:1, volumeM3:0.5, hourlyRates:{ workshop:100 } });
      return calc && Math.abs(Number(calc.volumeHours || 0) - 0.5) < 0.0001 && Number(calc.volumePrice || 0) === 0 && Math.abs(Number(calc.total || 0) - 150) < 0.0001;
    } },
    { name:'Moduły renderu Wyceny są wydzielone', explain:'Pilnuje splitu tabs/wycena.js → dom/status-actions/preview/shell/render-bridge.', check:()=> !!(FC.wycenaTabPreview && typeof FC.wycenaTabPreview.renderPreview === 'function') && !!(FC.wycenaTabShell && typeof FC.wycenaTabShell.render === 'function') && !!(FC.wycenaTabStatusActions && typeof FC.wycenaTabStatusActions.acceptSnapshot === 'function') && !!(FC.wycenaTabRenderBridge && typeof FC.wycenaTabRenderBridge.renderShell === 'function') },
    { name:'Zakładka Wyceny ma rozdzielone boundary warstwy', explain:'Pilnuje splitu tabs/wycena.js → data/state/selection-bridge/editor-bridge/status-controller/render-bridge.', check:()=> !!(FC.wycenaTabData && typeof FC.wycenaTabData.getSnapshotHistory === 'function' && FC.wycenaTabState && typeof FC.wycenaTabState.createState === 'function' && FC.wycenaTabSelectionBridge && typeof FC.wycenaTabSelectionBridge.ensureVersionNameBeforeGenerate === 'function' && FC.wycenaTabEditorBridge && typeof FC.wycenaTabEditorBridge.renderOfferEditor === 'function' && FC.wycenaTabStatusController && typeof FC.wycenaTabStatusController.createController === 'function' && FC.wycenaTabRenderBridge && typeof FC.wycenaTabRenderBridge.renderHistory === 'function') },
    { name:'Wybór zakresu Wyceny ma rozdzielone warstwy', explain:'Pilnuje splitu wycena-tab-selection.js → scope/version/model/pickers/render/fasada.', check:()=> !!(FC.wycenaTabSelectionScope && typeof FC.wycenaTabSelectionScope.buildSelectionSummary === 'function' && FC.wycenaTabSelectionVersion && typeof FC.wycenaTabSelectionVersion.ensureVersionNameBeforeGenerate === 'function' && FC.wycenaTabSelectionModel && typeof FC.wycenaTabSelectionModel.ensureVersionNameBeforeGenerate === 'function' && FC.wycenaTabSelectionPickers && typeof FC.wycenaTabSelectionPickers.openQuoteScopePicker === 'function' && FC.wycenaTabSelectionRender && typeof FC.wycenaTabSelectionRender.renderQuoteSelectionSection === 'function' && FC.wycenaTabSelection && typeof FC.wycenaTabSelection.renderQuoteSelectionSection === 'function') },
    { name:'Podstawowe fasady historii i statusów istnieją', explain:'Chroni wejścia używane przez render zakładki WYCENA po splicie.', check:()=> typeof FC.quoteSnapshotStore.listForProject === 'function' && typeof FC.projectStatusSync.resolveCurrentProjectStatus === 'function' },
    { name:'Statusy projektu mają rozdzielone lustra i workflow snapshotów', explain:'Pilnuje splitu project-status-sync.js na mirrors / engine / snapshot-flow.', check:()=> !!(FC.projectStatusMirrors && typeof FC.projectStatusMirrors.syncStatusMirrors === 'function' && FC.projectStatusSnapshotFlow && typeof FC.projectStatusSnapshotFlow.commitAcceptedSnapshot === 'function' && FC.projectStatusSync && typeof FC.projectStatusSync.promotePreliminarySnapshotToFinal === 'function') },
    { name:'Statusy pod harmonogram mają read-only boundary', explain:'Chroni moduł przygotowujący przyszły harmonogram: Pomiar i Wycena są kolejkami, a nie nowym storage.', check:()=> !!(FC.projectScheduleStatus && typeof FC.projectScheduleStatus.buildInvestorBuckets === 'function' && typeof FC.projectScheduleStatus.buildAllBuckets === 'function') },
    { name:'Wejście scope Wyceny ma rozdzielone warstwy', explain:'Pilnuje splitu quote-scope-entry.js na utils / scope / modal / flow / fasadę publiczną.', check:()=> !!(FC.quoteScopeEntryUtils && FC.quoteScopeEntryScope && FC.quoteScopeEntryModal && FC.quoteScopeEntryFlow && FC.quoteScopeEntry && typeof FC.quoteScopeEntry.ensureScopedQuoteEntry === 'function') },
  ]);
}

function runCabinetNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('SZAFKI node smoke testy', 'Szafki ↔ Node smoke', [
    { name:'Publiczne API szafek jest dostępne', explain:'Szybki kontrakt dla app-dev-smoke bez uruchamiania ciężkich testów modalowego DOM w Node.', check:()=> !!(FC.cabinetModal && FC.cabinetActions && FC.cabinetFronts) },
    { name:'Moduły modalowe szafek są załadowane', explain:'Chroni podstawowe wejścia używane przez modal szafki po splitach.', check:()=> !!(FC.cabinetModalDraft && FC.cabinetModalFields && FC.cabinetModalFinalize) },
    { name:'Modal szafki ma dodatki robocizny', explain:'Pilnuje wyboru usług dodatkowych z katalogu robocizny przy konkretnej szafce.', check:()=> !!(FC.cabinetModalLabor && typeof FC.cabinetModalLabor.renderLaborSection === 'function' && typeof FC.cabinetModalLabor.getDefinitions === 'function') },
    { name:'WYWIAD pokazuje zapisane dodatki robocizny szafki', explain:'Chroni podgląd dodatków robocizny na karcie szafki w WYWIADZIE.', check:()=> {
      const api = FC.wywiadLaborSummary;
      if(!(api && typeof api.getHeaderText === 'function' && typeof api.renderCabinetLaborSummary === 'function')) return false;
      const cab = { type:'wisząca', subType:'okap', details:{ applianceMountingMode:'none' }, laborItems:[{ rateId:'labor_hole_fi60', qty:2 }] };
      const header = api.getHeaderText(cab);
      const node = api.renderCabinetLaborSummary(cab);
      return /Otwór fi 60/.test(header) && /bez montażu/.test(header) && !!(node && node.textContent && /Otwór fi 60/.test(node.textContent) && /bez montażu/.test(node.textContent));
    } },
    { name:'Modal szafki ma robociznę po parametrach i materiałach', explain:'Chroni kolejność: najpierw typ, wymiary i materiały szafki, dopiero potem dodatkowe czynności.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      return html.indexOf('id="cmOpeningSystem"') > -1 && html.indexOf('id="cmLaborAddons"') > html.indexOf('id="cmOpeningSystem"') && html.indexOf('id="cmLaborAddons"') > html.indexOf('id="cmBodyColor"');
    } },
    { name:'Montaż sprzętu w modalu szafki używa chipów z ptaszkiem', explain:'Chroni wybór Z montażem / Bez montażu przed powrotem do zwykłych przycisków.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-labor.js'), 'utf8');
      return src.includes("make('label', `rozrys-scope-chip cabinet-labor-appliance__choice") && src.includes("cb.type = 'checkbox'") && src.includes('api.setMountingMode(draft, opt.value)') && !src.includes("make('button', `rozrys-scope-chip cabinet-labor-appliance__choice");
    } },
    { name:'Hardware frontów jest załadowany', explain:'Chroni kalkulatory i katalogi używane przy frontach/podnośnikach.', check:()=> !!(FC.frontHardware && FC.frontHardwareAventosCalc && FC.frontHardwareAventosData && FC.frontHardwareAventosSelector) },
  ]);
}

function runServiceNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('USŁUGI node smoke testy', 'Usługi ↔ Node smoke', [
    { name:'Service order store jest dostępny', check:()=> !!(FC.serviceOrderStore && typeof FC.serviceOrderStore.readAll === 'function') },
    { name:'Service orders API jest dostępne', check:()=> !!(FC.serviceOrders && typeof FC.serviceOrders.openEditor === 'function') },
    { name:'Cutting service API jest dostępne', check:()=> !!(FC.serviceCuttingCommon && FC.serviceCuttingRozrys) },
  ]);
}

function mergeReports(reports){
  const out = { label:'APP smoke testy', total:0, passed:0, failed:0, durationMs:0, groups:[] };
  reports.forEach((report)=>{
    if(!report) return;
    out.total += report.total || 0;
    out.passed += report.passed || 0;
    out.failed += report.failed || 0;
    out.durationMs += report.durationMs || 0;
    (report.groups || []).forEach((group)=> out.groups.push(group));
  });
  return out;
}

async function runFreshReport(run){
  const sandbox = makeLoadedSandbox();
  return run(sandbox);
}

async function runAppDevSmoke(){
  const sandbox = makeLoadedSandbox();
  const reports = [
    runProjectNodeSmoke(sandbox),
    runDataNodeSmoke(sandbox),
    runRysunekNodeSmoke(sandbox),
    runInvestorNodeSmoke(sandbox),
    runMaterialNodeSmoke(sandbox),
    runWycenaNodeSmoke(sandbox),
    runCabinetNodeSmoke(sandbox),
    runServiceNodeSmoke(sandbox),
  ];
  const final = mergeReports(reports);
  const text = sandbox.FC.testHarness.makeClipboardReport(final);
  return { final, text };
}

if(require.main === module){
  runAppDevSmoke().then(({ final, text })=>{
    console.log(text);
    process.exit(final.failed > 0 ? 1 : 0);
  }).catch((error)=>{
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(2);
  });
}

module.exports = {
  createSandbox, loadSmokeFiles, makeLoadedSandbox, mergeReports, runFreshReport, runAppDevSmoke,
  runProjectNodeSmoke, runDataNodeSmoke, runRysunekNodeSmoke, runInvestorNodeSmoke, runMaterialNodeSmoke,
  runWycenaNodeSmoke, runCabinetNodeSmoke, runServiceNodeSmoke,
};
