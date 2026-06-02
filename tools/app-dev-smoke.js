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
    { name:'Preferencje pokoju normalizują się w projekcie', explain:'Pilnuje pola room.preferences jako części modelu projektu, bez osobnego storage — także preferencji producentów okuć.', check:()=> {
      const out = FC.projectModel.normalizeProjectData({ schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{}, preferences:{ bodyColor:'Czarny', openingSystemModule:'TIP-ON', hardwareProducers:{ hinges:'GTV', accessories:'Rejs' } } } });
      return !!(out && out.kuchnia && out.kuchnia.preferences && out.kuchnia.preferences.zones && out.kuchnia.preferences.zones.lower.bodyColor === 'Czarny' && out.kuchnia.preferences.zones.middle.openingSystem === 'TIP-ON' && out.kuchnia.preferences.hardwareProducers && out.kuchnia.preferences.hardwareProducers.hinges === 'GTV' && out.kuchnia.preferences.hardwareProducers.accessories === 'Rejs' && out.szafa && out.szafa.preferences && out.szafa.preferences.zones && out.szafa.preferences.hardwareProducers);
    } },
    { name:'Wywiad ma zwinięte akordeony inline bez przycisków modalnych', explain:'Pilnuje poprawki UX: Parametry, producenci okuć oraz materiały/kolory są edytowane bezpośrednio w akordeonach, domyślnie zwiniętych.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      return html.includes('id="roomParametersAccordion"')
        && html.includes('id="roomHardwareProducerPreferencesAccordion"')
        && html.includes('id="roomPreferencesAccordion"')
        && html.includes('Preferencje producentów okuć')
        && html.includes('Preferencje materiałów i kolorów')
        && html.includes('wywiad-room-accordion__body wywiad-room-accordion__body--inline" id="roomSettingsSummary"')
        && html.includes('wywiad-room-accordion__body wywiad-room-accordion__body--inline" id="roomHardwareProducerPreferencesSummary"')
        && html.includes('wywiad-room-accordion__body wywiad-room-accordion__body--inline" id="roomPreferencesSummary"')
        && html.includes('js/app/ui/wywiad-room-hardware-producers.js')
        && !html.includes('id="openRoomSettingsBtn"')
        && !html.includes('id="openRoomPreferencesBtn"')
        && !html.includes('roomParametersAccordion" open')
        && !html.includes('roomHardwareProducerPreferencesAccordion" open')
        && !html.includes('roomPreferencesAccordion" open');
    } },
    { name:'Preferencje producentów okuć zapisują Pozostałe akcesoria', explain:'Chroni zgłoszoną regresję: wybór w polu Pozostałe akcesoria nie może znikać po kliknięciu Zapisz zmiany.', check:()=> {
      if(!(FC.roomPreferences && typeof FC.roomPreferences.setRoomPreferences === 'function' && typeof FC.roomPreferences.getRoomPreferences === 'function')) return false;
      const previous = sandbox.projectData;
      sandbox.projectData = FC.projectModel.normalizeProjectData({ schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{}, preferences:{} } });
      FC.roomPreferences.setRoomPreferences('kuchnia', { hardwareProducers:{ hinges:'Blum', accessories:'Rejs' } }, { skipSave:true });
      const got = FC.roomPreferences.getRoomPreferences('kuchnia');
      sandbox.projectData = previous;
      return !!(got && got.hardwareProducers && got.hardwareProducers.hinges === 'Blum' && got.hardwareProducers.accessories === 'Rejs');
    } },
    { name:'UI producentów okuć czyta wartości z launcherów przy zapisie', explain:'Chroni mobilny scenariusz, w którym formularz zostaje przebudowany albo closure draftu jest nieaktualne — Zapisz zmiany ma czytać realne wartości pól, w tym Pozostałe akcesoria.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/wywiad-room-hardware-producers.js'), 'utf8');
      return src.includes('function readFormSelections')
        && src.includes('data-hardware-producer-key')
        && src.includes('data-hardware-producer-value')
        && src.includes('rememberDraft(room, draft)')
        && src.includes('readFormSelections(form, working)');
    } },
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
    { name:'Globalne domyślne programu mają store i backupowany klucz', explain:'Pilnuje trybiku strony głównej: domyślne materiały i okucia siedzą w fc_program_defaults_v1, a nie w WYWIADZIE pokoju.', check:()=> {
      const api = FC.programDefaults;
      if(!(api && api.STORAGE_KEY === 'fc_program_defaults_v1' && typeof api.write === 'function' && typeof api.read === 'function' && typeof api.applyMaterialsToDraft === 'function')) return false;
      api.write({ materials:{ bodyColor:'Egger W1100', frontMaterial:'laminat', frontColor:'Egger W1100', backMaterial:'HDF 3mm biała' }, hardware:{ hingesManufacturer:'Blum', drawerSystemManufacturer:'Rejs', liftManufacturer:'Blum', accessoriesManufacturer:'Rejs' } });
      const saved = api.read();
      const draft = {};
      api.applyMaterialsToDraft(draft, saved);
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const menu = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/data-settings-menu-view.js'), 'utf8');
      const classifier = fs.readFileSync(path.join(process.cwd(), 'js/app/shared/data-storage-classifier.js'), 'utf8');
      return saved.materials.bodyColor === 'Egger W1100'
        && saved.hardware.drawerSystemManufacturer === 'Rejs'
        && saved.hardware.accessoriesManufacturer === 'Rejs'
        && draft.frontColor === 'Egger W1100'
        && html.includes('js/app/settings/program-defaults-store.js')
        && html.includes('js/app/ui/data-settings-defaults-view.js')
        && menu.includes('Domyślne materiały i okucia')
        && classifier.includes('fc_program_defaults_v1');
    } },
    { name:'Domyślne materiały i okucia trzymają wzorzec ROZRYS bez natywnych selectów i strzałek w launcherach', explain:'Pilnuje poprawki UI: w trybiku wybory mają być launcherami aplikacji, bez systemowego pickera, bez liczników i bez strzałek w przyciskach wyboru; akordeon ma używać geometrii chevrona ROZRYS.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/data-settings-defaults-view.js'), 'utf8');
      const css = fs.readFileSync(path.join(process.cwd(), 'css/data-settings.css'), 'utf8');
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      return !src.includes("h('select'")
        && !src.includes('makeSelectField')
        && !src.includes("sub:'4'")
        && !src.includes("sub:'5'")
        && src.includes('makeChoiceField')
        && src.includes('FC.rozrysChoice')
        && css.includes('Program defaults ROZRYS sync v1')
        && css.includes('.data-settings-default-choice .rozrys-choice-launch__arrow')
        && css.includes('display:none!important')
        && css.includes('border-right:3px solid #166534')
        && !css.includes(".data-settings-defaults-card .data-settings-accordion__toggle::before{\n  content:'▾'")
        && src.includes("dom.makeAccordion('Materiały', [materialGrid], { open:false })")
        && src.includes("dom.makeAccordion('Okucia', [hardwareGrid], { open:false })")
        && src.includes('rozrys-choice-launch--options-clean')
        && html.includes('20260524_hardware_producer_preferences_v1');
    } },
    { name:'Backup store jest dostępny', check:()=> !!(FC.dataBackupStore && typeof FC.dataBackupStore.listBackups === 'function') },
    { name:'BACKUP.md opisuje zakres backupu i jest podpięty do dokumentacji', explain:'Pilnuje decyzji: przed zmianami storage/backup trzeba czytać osobny dokument BACKUP.md, a nie zgadywać zakres snapshotu.', check:()=> {
      const backupDoc = fs.readFileSync(path.join(process.cwd(), 'BACKUP.md'), 'utf8');
      const devDoc = fs.readFileSync(path.join(process.cwd(), 'DEV.md'), 'utf8');
      const cloudDoc = fs.readFileSync(path.join(process.cwd(), 'CLOUD_MIGRATION.md'), 'utf8');
      return backupDoc.includes('fc_data_backups_v1')
        && backupDoc.includes('data-storage-keys.js')
        && backupDoc.includes('fc_rozrys_plan_cache_v1')
        && backupDoc.includes('before-tests')
        && backupDoc.includes('fc_hardware_technical_params_v1')
        && backupDoc.includes('[object Object]')
        && devDoc.includes('BACKUP.md')
        && cloudDoc.includes('BACKUP.md');
    } },
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
    { name:'Katalog okuć ma dostawców, ustawienia i model ceny do wyceny', explain:'Pilnuje rozdzielenia kosztu firmy od ceny dla klienta: VAT globalny, rabat dostawcy, zakup po rabacie, narzut i cena do wyceny.', check:()=> {
      const hw = FC.hardwareCatalog;
      const store = FC.catalogStore;
      if(!(hw && store && typeof store.getHardwareSuppliers === 'function' && typeof store.getHardwareSettings === 'function')) return false;
      const settings = Object.assign({}, store.getHardwareSettings(), { defaultVatRate:23, hardwareSuppliers:[{ id:'mago', name:'MAGO', defaultDiscountPercent:15, defaultVatRate:8, active:true }] });
      const normalizedSupplier = hw.normalizeSupplier({ id:'mago', name:'MAGO', defaultDiscountPercent:15, defaultVatRate:8, active:true });
      const row = hw.normalizeAccessory({ name:'Test cena', manufacturer:'Blum', supplierId:'mago', supplierPrices:[{ supplierId:'mago', catalogPriceNet:100, useForQuote:true }], quoteBase:'catalogGross', pricingMode:'markup', markupPercent:20, hardwareCategory:'Zawiasy' }, ()=> 'hw_price_test', settings);
      return row.id === 'hw_price_test'
        && normalizedSupplier.defaultVatRate == null
        && Math.abs(Number(row.catalogPriceGross) - 123) < 0.001
        && Math.abs(Number(row.purchasePriceGross) - 104.55) < 0.001
        && Math.abs(Number(row.price) - 147.6) < 0.001
        && Math.abs(Number(row.marginGross) - 43.05) < 0.001;
    } },
    { name:'Katalog okuć ma aplikacyjne filtry, sortowanie, dostawców i ustawienia', explain:'Chroni toolbar okuć: Filtry, Sortuj, Dostawcy i Ustawienia mają pozostać osobnymi oknami aplikacji.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const filters = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-filter-sort.js'), 'utf8');
      const suppliers = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-suppliers.js'), 'utf8');
      return ['openHardwareFiltersBtn','openHardwareSortBtn','manageHardwareSuppliersBtn','openHardwareSettingsBtn'].every((id)=> html.includes(id)) && filters.includes('Filtry okuć') && filters.includes('Sortuj okucia') && suppliers.includes('Dostawcy okuć') && suppliers.includes('Ustawienia cen okuć') && suppliers.includes('Globalny VAT %') && !suppliers.includes("label', { text:'VAT %'");
    } },
    { name:'Formularz okuć ma wrapper ceny prostej bez błędu startu', explain:'Chroni otwarcie Dodaj okucie przed ReferenceError formPriceWrapper po rozbudowie pól cen okuć.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-item-form.js'), 'utf8');
      return src.includes('function formPriceWrapper()') && src.includes("const priceWrap = formPriceWrapper();") && src.includes("priceWrap.style.display = cfg.formKind === 'accessory' ? 'none' : ''");
    } },
    { name:'Katalog okuć rozdziela kpl. od składanych zestawów', explain:'Pilnuje, że kpl. jest normalną jednostką kompletu, para jest normalizowana do kpl., a skład pokazuje się tylko dla zestawu albo pozycji mającej bundleItems.', check:()=> {
      const hw = FC.hardwareCatalog;
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const form = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-form.js'), 'utf8');
      const bundle = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-bundle.js'), 'utf8');
      if(!(hw && typeof hw.normalizeAccessory === 'function' && typeof hw.normalizeBundleItems === 'function' && typeof hw.isBundleUnit === 'function')) return false;
      const row = hw.normalizeAccessory({ id:'set1', name:'Zestaw', manufacturer:'Blum', hardwareUnit:'zestaw', bundleCostMode:'components', bundleItems:[{ itemId:'a', qty:2 }, { itemId:'set1', qty:1 }, { itemId:'a', qty:4 }] }, ()=> 'unused');
      return hw.isBundleUnit('zestaw') && !hw.isBundleUnit('kpl.') && hw.normalizeUnit('para') === 'kpl.' && !hw.UNITS.includes('para') && row.bundleCostMode === 'components' && Array.isArray(row.bundleItems) && row.bundleItems.length === 1 && row.bundleItems[0].qty === 2 && html.includes('id="hardwareBundleFields"') && html.includes('id="hardwareBundleCostMode"') && bundle.includes('bundleItemsDraft.length > 0') && bundle.includes('openPicker') && bundle.includes('priceModalHardwareBundle') && form.includes('clearPairIfSourceEmpty');
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
      const priceConfirm = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-price-confirm.js'), 'utf8');
      if(!(api && typeof api.buildImportPlan === 'function' && typeof api.applyImportPlan === 'function' && typeof api.exportJson === 'function' && typeof api.exportXlsx === 'function' && typeof api.findRequiredGaps === 'function')) return false;
      if(!(xlsx && typeof xlsx.makeWorkbookBlob === 'function' && typeof xlsx.readWorkbook === 'function')) return false;
      return Number(api.VERSION) >= 3 && html.includes('id="openHardwareImportExportBtn"') && html.includes('hardware-catalog-import-export.js') && html.includes('price-modal-hardware-import-resolver.js') && html.includes('price-modal-hardware-price-confirm.js') && html.includes('price-modal-hardware-import-export.js') && ui.includes('Import / Eksport okuć') && ui.includes('lokalną kopię .xlsx') && ui.includes('Dysku Google/Arkuszy') && ui.includes('Tryb importu') && ui.includes('Scal / aktualizuj') && ui.includes('Zastąp katalog') && ui.includes('renderModeChoices') && ui.includes('makeFileSnapshot') && ui.includes('readWithFileReader') && ui.includes('fileReadHint') && ui.includes('__fcFileSnapshot') && ui.includes('snapshot = await makeFileSnapshot(file)') && ui.includes("input.value = '';\n      await onFile(snapshot)") && ui.includes('confirmSupplierPriceChanges') && resolver.includes('Ignoruj wszystko') && resolver.includes('Uzupełnij brakujące pola obowiązkowe') && priceConfirm.includes('Dodać nową cenę') && priceConfirm.includes('Zaktualizować cenę');
    } },
    { name:'Testy import/export okuć używają Array.from dla NodeList', explain:'Chroni dev_tests.html w przeglądarce: NodeList z querySelectorAll nie ma .find na Android/Chrome, więc test potwierdzeń nie może wysypać się przed kliknięciem.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/testing/material/accessories-import-export-deep-tests.js'), 'utf8');
      return src.includes("Array.from(rootNode.querySelectorAll('button') || []).find") && !/return\s*\(rootNode\.querySelectorAll\('button'\) \|\| \[\]\)\.find/.test(src);
    } },
    { name:'Import/export okuć jest rozdzielony pod stabilnymi fasadami', explain:'Pilnuje splitu: ciężkie moduły parsera, planu, eksportu i cen dostawców nie znikają z load order.', check:()=> {
      const api = FC.hardwareCatalogImportExport, price = FC.hardwareSupplierPriceXlsx;
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const files = [
        'hardware-supplier-price-export.js',
        'hardware-supplier-price-import.js',
        'hardware-catalog-export-xlsx.js',
        'hardware-catalog-import-parser.js',
        'hardware-catalog-import-plan.js'
      ];
      return !!(api && price && FC.hardwareCatalogExportXlsx && FC.hardwareCatalogImportParser && FC.hardwareCatalogImportPlan && FC.hardwareSupplierPriceExport && FC.hardwareSupplierPriceImport)
        && typeof api.buildImportPlan === 'function'
        && typeof api.parseWorkbook === 'function'
        && typeof api.exportXlsx === 'function'
        && typeof price.applySupplierPriceRows === 'function'
        && files.every((name)=> html.includes(name));
    } },
    { name:'Katalog okuć ma UX statusu ceny i szybkich filtrów', explain:'Chroni czytelne karty okuć: status ceny, filtr Do sprawdzenia cen oraz podgląd zestawów/składników.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const uxSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-ux.js'), 'utf8');
      const listSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-list.js'), 'utf8');
      const css = fs.readFileSync(path.join(process.cwd(), 'css/price-item-popup.css'), 'utf8');
      const ctx = FC.priceModalContext || {};
      if(!(typeof ctx.hardwarePriceStatus === 'function' && typeof ctx.hardwareItemNeedsPriceCheck === 'function' && typeof ctx.matchesHardwareQuickFilter === 'function' && typeof ctx.renderHardwareAccessoryRow === 'function')) return false;
      const noPrice = ctx.hardwarePriceStatus({ name:'Brak', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareUnit:'szt.' });
      const imported = ctx.hardwarePriceStatus({ name:'Import', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', price:10, priceSource:'Import Excel', priceUpdatedAt:'2026-05-10' });
      const importedCurrent = ctx.hardwarePriceStatus({ name:'Import current', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', price:10, priceSource:'Import Excel', priceUpdatedAt:'2026-05-10', priceStatus:'current' });
      const stale = ctx.hardwarePriceStatus({ name:'Stare', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', price:10, priceSource:'Bivert', priceUpdatedAt:'2020-01-01' });
      return noPrice.code === 'noPrice' && imported.code === 'check' && importedCurrent.code === 'current' && stale.code === 'stale'
        && html.includes('price-modal-hardware-ux.js')
        && uxSrc.includes('Do sprawdzenia cen') && uxSrc.includes('Składniki:') && uxSrc.includes('Zestawy')
        && listSrc.includes('renderHardwareQuickFilters') && listSrc.includes('renderHardwareAccessoryRow')
        && css.includes('.hardware-price-row') && css.includes('.hardware-quick-filters') && uxSrc.includes('hardware-price-row__status-actions') && css.includes('.hardware-price-row__edit-btn');
    } },
    { name:'Eksport XLSX okuć ma arkusz cen dostawców i listy wyboru', explain:'Chroni model wielu cen: Okucia trzymają produkt techniczny, a Ceny_dostawcow pozwala duplikować wiersze i zmieniać dostawcę/cenę bez ręcznego ID ceny.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      const supplierXlsx = FC.hardwareSupplierPriceXlsx;
      const xlsx = FC.xlsxLite;
      if(!(api && api._debug && typeof api._debug.buildAccessoryRows === 'function' && typeof api._debug.accessoryValidations === 'function')) return false;
      if(!(supplierXlsx && typeof supplierXlsx.buildSupplierPriceRows === 'function' && typeof supplierXlsx.supplierPriceValidations === 'function')) return false;
      if(!(xlsx && xlsx._debug && typeof xlsx._debug.validationsXml === 'function')) return false;
      const rows = api._debug.buildAccessoryRows([{ id:'hw_test_xlsx', status:'active', manufacturer:'Blum', symbol:'XLSX', name:'Test XLSX', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', bundleCostMode:'ownPrice' }]);
      const priceRows = supplierXlsx.buildSupplierPriceRows([{ id:'hw_test_xlsx', manufacturer:'Blum', symbol:'XLSX', name:'Test XLSX', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', supplierPrices:[{ supplierId:'bivert', catalogPriceNet:10, catalogPriceGross:12.3, useForQuote:true, priceDate:'2026-05-10' }] }], [{ id:'bivert', name:'Bivert', defaultVatRate:23, defaultDiscountPercent:0, active:true }]);
      const validationXml = xlsx._debug.validationsXml(supplierXlsx.supplierPriceValidations());
      const headers = rows[0] || [];
      const priceHeaders = priceRows[0] || [];
      const supplierHeaders = (api.SUPPLIER_COLUMNS || []).map((pair)=> pair[0]);
      const emptyTemplateRow = priceRows[priceRows.length - 1] || [];
      const emptyHasFormula = emptyTemplateRow.some((cell)=> cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'formula'));
      return rows.length >= 200
        && headers[0] === 'nazwa'
        && headers[headers.length - 1] === 'id'
        && priceHeaders[0] === 'okucie_nazwa'
        && priceHeaders[2] === 'producent'
        && priceHeaders[3] === 'kategoria'
        && priceHeaders[4] === 'jednostka'
        && priceHeaders[5] === 'dostawca'
        && priceHeaders[priceHeaders.length - 2] === 'okucie_id'
        && priceHeaders[priceHeaders.length - 1] === 'dostawca_id'
        && priceRows[1][0] === 'Test XLSX'
        && priceRows[1][2] === 'Blum'
        && priceRows[1][3] === 'Zawiasy'
        && priceRows[1][4] === 'szt.'
        && priceRows[1][5] === 'Bivert'
        && priceRows[1][8] === 'TAK'
        && supplierHeaders.includes('rabat_domyslny_proc')
        && !supplierHeaders.includes('vat_domyslny_proc')
        && emptyHasFormula === false
        && validationXml.includes('C2:C261')
        && validationXml.includes('D2:D261')
        && validationXml.includes('E2:E261')
        && validationXml.includes('F2:F261')
        && validationXml.includes('I2:I261')
        && !validationXml.includes('para');
    } },
    { name:'Import XLSX cen dostawców liczy brakujące netto/brutto i zachowuje status', explain:'Chroni scenariusz z telefonu: skopiowany wiersz ceny dostawcy może mieć wpisaną tylko cenę netto albo tylko brutto, a status current nie może zmieniać listy na Do sprawdzenia.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      const hw = FC.hardwareCatalog;
      const store = FC.catalogStore;
      if(!(api && hw && store && typeof api.buildImportPlan === 'function' && typeof hw.typeOptions === 'function' && typeof hw.uniqueTypeConflict === 'function')) return false;
      const before = store.getAccessories();
      const existing = before.find((row)=> String(row && row.id || '')) || before[0];
      if(!existing) return false;
      const suppliers = [{ id:'bivert', name:'Bivert', defaultVatRate:23, defaultDiscountPercent:0, active:true }, { id:'mago', name:'MAGO', defaultVatRate:23, defaultDiscountPercent:0, active:true }, { id:'local', name:'Hurtownia lokalna', defaultVatRate:23, defaultDiscountPercent:0, active:true }];
      const plan = api.buildImportPlan({
        accessories:[Object.assign({}, existing, { id:existing.id, name:existing.name || 'Test', manufacturer:existing.manufacturer || 'Blum', hardwareCategory:existing.hardwareCategory || 'Zawiasy', hardwareUnit:existing.hardwareUnit || 'szt.' })],
        suppliers,
        supplierPriceRows:[
          { __rowIndex:2, okucie_id:existing.id, dostawca:'Bivert', cena_netto:8, cena_brutto:9.84, do_wyceny:'NIE', status_ceny:'current', data_ceny:'2026-05-10' },
          { __rowIndex:3, okucie_id:existing.id, dostawca:'MAGO', cena_netto:12, cena_brutto:'', do_wyceny:'TAK', status_ceny:'current', data_ceny:'2026-05-10' },
          { __rowIndex:4, okucie_id:existing.id, dostawca:'MAGO', cena_netto:'#REF!', cena_brutto:'#REF!', do_wyceny:'NIE', status_ceny:'current' },
          { __rowIndex:5, okucie_id:existing.id, dostawca:'Hurtownia lokalna', dostawca_id:'mago', cena_netto:9, cena_brutto:'', do_wyceny:'NIE', status_ceny:'current', data_ceny:'2026-05-10' }
        ],
        settings:{ defaultVatRate:23, defaultSupplierId:'bivert', defaultMarkupPercent:20, defaultQuoteBase:'catalogGross', defaultPricingMode:'markup' },
      }, { mode:'merge' });
      if(plan.errors.length) return false;
      const row = plan.next.accessories.find((item)=> String(item && item.id || '') === String(existing.id));
      const mago = row && Array.isArray(row.supplierPrices) ? row.supplierPrices.find((price)=> String(price.supplierId) === 'mago') : null;
      const local = row && Array.isArray(row.supplierPrices) ? row.supplierPrices.find((price)=> String(price.supplierId) === 'local') : null;
      const status = (FC.priceModalContext && typeof FC.priceModalContext.hardwarePriceStatus === 'function') ? FC.priceModalContext.hardwarePriceStatus(row) : null;
      return !!(mago && Number(mago.catalogPriceNet) === 12 && Number(mago.catalogPriceGross) === 14.76 && mago.useForQuote === true && local && Number(local.catalogPriceNet) === 9 && Number(local.catalogPriceGross) === 11.07 && local.useForQuote === false && row.priceStatus === 'current' && row.priceSource === 'MAGO' && status && status.code === 'current' && plan.summary.supplierPrices === 3 && plan.summary.supplierPricesSkipped === 0 && plan.warnings.some((msg)=> String(msg || '').includes('dostawca_id wskazuje')));
    } },
    { name:'Hurtowy import cen dopasowuje po producent+symbol bez ręcznego ID', explain:'Chroni wklejanie cennika z hurtowni: użytkownik nie musi kopiować okucie_id ani id_ceny, jeśli ma producenta, symbol i dostawcę.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      const store = FC.catalogStore;
      if(!(api && store && typeof store.savePriceList === 'function' && typeof store.getAccessories === 'function')) return false;
      const previousAccessories = store.getAccessories();
      const previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
      try{
        store.savePriceList('accessories', [{ id:'bulk_hw_1', manufacturer:'Blum', symbol:'BULK-1', name:'Test hurtowy', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', status:'active', supplierPrices:[] }]);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultVatRate:23, defaultDiscountPercent:0, active:true }]);
        const plan = api.buildImportPlan({
          accessories:[],
          suppliers:[],
          supplierPriceRows:[{ __rowIndex:2, producent:'Blum', okucie_symbol:'BULK-1', dostawca:'MAGO', cena_brutto:12.3, status_ceny:'current', data_ceny:'2026-05-11' }],
          settings:{}
        }, { mode:'merge' });
        const item = plan.next.accessories.find((row)=> String(row && row.id || '') === 'bulk_hw_1');
        const price = item && Array.isArray(item.supplierPrices) ? item.supplierPrices.find((row)=> String(row && row.supplierId || '') === 'mago') : null;
        return plan.errors.length === 0 && plan.summary.accessoryRows === 0 && plan.summary.updated === 0 && plan.summary.supplierPrices === 1 && plan.summary.supplierPricesAdded === 1 && price && Number(price.catalogPriceGross) === 12.3 && Number(price.catalogPriceNet) === 10;
      }finally{
        store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
      }
    } },
    { name:'Ceny dostawców mogą utworzyć nowe okucie bez ręcznego ID', explain:'Chroni hurtowe wklejanie cennika: jeśli w Ceny_dostawcow jest istniejący producent, symbol i nazwa, import tworzy okucie i podpina cenę; nie tworzy producentów z literówek.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      const store = FC.catalogStore;
      if(!(api && store && typeof store.savePriceList === 'function' && typeof store.getAccessories === 'function')) return false;
      const previousAccessories = store.getAccessories();
      const previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
      const previousManufacturers = store.getHardwareManufacturers ? store.getHardwareManufacturers() : [];
      try{
        store.savePriceList('accessories', []);
        if(store.saveHardwareManufacturers) store.saveHardwareManufacturers(['Blum']);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultVatRate:23, defaultDiscountPercent:0, active:true }]);
        const plan = api.buildImportPlan({
          accessories:[], suppliers:[], settings:{},
          supplierPriceRows:[{ __rowIndex:12, producent:'blum', okucie_symbol:'NEW-FROM-PRICE', okucie_nazwa:'Nowe okucie z ceny', kategoria:'Zawiasy', jednostka:'kpl.', dostawca:'MAGO', cena_netto:10, status_ceny:'current' }]
        }, { mode:'merge' });
        const created = plan.next.accessories.find((row)=> String(row && row.symbol || '') === 'NEW-FROM-PRICE');
        const price = created && Array.isArray(created.supplierPrices) ? created.supplierPrices.find((row)=> String(row && row.supplierId || '') === 'mago') : null;
        const missingPlan = api.buildImportPlan({
          accessories:[], suppliers:[], settings:{},
          supplierPriceRows:[{ __rowIndex:14, producent:'Blum', okucie_symbol:'NO-CAT', okucie_nazwa:'Brak kategorii', dostawca:'MAGO', cena_netto:7 }]
        }, { mode:'merge' });
        const badPlan = api.buildImportPlan({
          accessories:[], suppliers:[], settings:{},
          supplierPriceRows:[{ __rowIndex:13, producent:'Bluum', okucie_symbol:'BAD-PROD', okucie_nazwa:'Nie twórz producenta', dostawca:'MAGO', cena_netto:5 }]
        }, { mode:'merge' });
        return plan.errors.length === 0
          && plan.summary.added === 1
          && plan.summary.supplierPriceCreatedAccessories === 1
          && created && String(created.manufacturer || '') === 'Blum'
          && String(created.hardwareCategory || '') === 'Zawiasy'
          && String(created.hardwareUnit || '') === 'kpl.'
          && price && Number(price.catalogPriceNet) === 10 && Number(price.catalogPriceGross) === 12.3 && String(price.priceDate || '').length === 10
          && missingPlan.summary.added === 0
          && missingPlan.summary.supplierPriceCreatedAccessories === 0
          && missingPlan.warnings.some((msg)=> String(msg || '').includes('wymaga wyboru kategorii'))
          && badPlan.summary.added === 0
          && badPlan.summary.supplierPriceCreatedAccessories === 0
          && badPlan.warnings.some((msg)=> String(msg || '').includes('producenta spoza słownika'));
      }finally{
        store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
        if(store.saveHardwareManufacturers) store.saveHardwareManufacturers(previousManufacturers);
      }
    } },
    { name:'Katalog okuć przenosi system i parametry szuflad z Excela', explain:'Chroni nowy model pod listy zakupowe: system_okucia, długość, nośność i wzmocnienie muszą przejść przez parser i plan importu.', check:()=> {
      const api = FC.hardwareCatalogImportExport, store = FC.catalogStore;
      if(!(api && store && typeof api.parseWorkbook === 'function' && typeof api.buildImportPlan === 'function')) return false;
      const previousAccessories = store.getAccessories ? store.getAccessories() : [];
      const previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
      const previousManufacturers = store.getHardwareManufacturers ? store.getHardwareManufacturers() : [];
      try{
        store.savePriceList('accessories', []);
        if(store.saveHardwareManufacturers) store.saveHardwareManufacturers(['Blum']);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, active:true }]);
        const parsed = api.parseWorkbook({ Okucia:[
          ['nazwa','jednostka','producent','kategoria','system_okucia','typ_cecha','symbol','profil_szuflady','dlugosc_mm','nosnosc_kg','wzmocniona','kolor_okucia','zastosowanie'],
          ['Tandembox M 500','kpl.','Blum','Szuflady / prowadnice','Blum TANDEMBOX','M 500 50kg','TB-500','M',500,50,'TAK','biały','frontowa']
        ], Producenci:[['nazwa'], ['Blum']], Dostawcy:[['id','nazwa','rabat_domyslny_proc','aktywny'], ['mago','MAGO',0,'TAK']] });
        const plan = api.buildImportPlan(parsed, { mode:'merge' });
        const item = plan.next.accessories.find((row)=> String(row && row.symbol || '') === 'TB-500');
        return plan.errors.length === 0 && item && String(item.hardwareSystem || '') === 'Blum TANDEMBOX' && String(item.hardwareType || '').includes('M') && String(item.hardwareType || '').includes('500') && String(item.hardwareType || '').includes('50') && Number(item.drawerLengthMm) === 500 && Number(item.drawerLoadKg) === 50 && item.drawerReinforced === true;
      }finally{
        if(store.savePriceList) store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
        if(store.saveHardwareManufacturers) store.saveHardwareManufacturers(previousManufacturers);
      }
    } },
    { name:'Ceny dostawców zachowują prosty początek arkusza i opcjonalne dane techniczne', explain:'Chroni wygodne wklejanie cen: dostawca i cena zostają z przodu, a dane techniczne są dodatkiem pod nowe pozycje.', check:()=> {
      const xlsx = FC.hardwareSupplierPriceXlsx;
      if(!(xlsx && Array.isArray(xlsx.SUPPLIER_PRICE_COLUMNS))) return false;
      const headers = xlsx.SUPPLIER_PRICE_COLUMNS.map((pair)=> pair[0]);
      return headers.slice(0, 6).join('|') === 'okucie_nazwa|okucie_symbol|producent|kategoria|jednostka|dostawca'
        && headers.includes('system_okucia') && headers.includes('dlugosc_mm') && headers.includes('nosnosc_kg')
        && headers[headers.length - 2] === 'okucie_id' && headers[headers.length - 1] === 'dostawca_id';
    } },

    { name:'Resolver nowego okucia z arkusza cen wymaga dostawcy kategorii i jednostki', explain:'Chroni import XLSX: wiersz z nazwą, symbolem, producentem i ceną, ale bez dostawcy/kategorii/jednostki ma trafić do uzupełnienia, a nie zostać po cichu pominięty.', check:()=> {
      const api = FC.hardwareCatalogImportExport, xlsx = FC.hardwareSupplierPriceXlsx, store = FC.catalogStore;
      if(!(api && xlsx && store && typeof store.savePriceList === 'function')) return false;
      const previousAccessories = store.getAccessories ? store.getAccessories() : [], previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [], previousManufacturers = store.getHardwareManufacturers ? store.getHardwareManufacturers() : [];
      try{
        const invoice = { id:'invoice', name:'Faktura / zakup ręczny', defaultVatRate:23, defaultDiscountPercent:0, active:true };
        store.savePriceList('accessories', []);
        if(store.saveHardwareManufacturers) store.saveHardwareManufacturers(['Peka']);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers([invoice]);
        const row = { __rowIndex:21, okucie_nazwa:'gitara', okucie_symbol:'git', producent:'Peka', cena_netto:30 };
        const gaps = xlsx.supplierPriceCreateRequiredGaps([row], [], [invoice], ['Peka']);
        if(!(gaps.length === 1 && ['supplierName','itemCategory','itemUnit'].every((key)=> gaps[0].gaps.includes(key)))) return false;
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{}, supplierPriceRows:[Object.assign({}, row, { dostawca:'Faktura / zakup ręczny', kategoria:'Zawiasy', jednostka:'szt.' })] }, { mode:'merge' });
        const created = plan.next.accessories.find((item)=> String(item && item.symbol || '') === 'git');
        const price = created && Array.isArray(created.supplierPrices) ? created.supplierPrices.find((priceRow)=> String(priceRow && priceRow.supplierId || '') === 'invoice') : null;
        return plan.errors.length === 0 && plan.summary.supplierPriceCreatedAccessories === 1 && plan.summary.supplierPricesAdded === 1 && created && String(created.name || '') === 'gitara' && String(created.manufacturer || '') === 'Peka' && String(created.hardwareCategory || '') === 'Zawiasy' && String(created.hardwareUnit || '') === 'szt.' && price && Number(price.catalogPriceNet) === 30 && Number(price.catalogPriceGross) === 36.9;
      }finally{
        if(store.savePriceList) store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
        if(store.saveHardwareManufacturers) store.saveHardwareManufacturers(previousManufacturers);
      }
    } },
    { name:'Import cen nie zgłasza fałszywych duplikatów dla tego samego okucia z eksportu', explain:'Chroni podgląd importu: gdy to samo okucie jest w katalogu i w arkuszu Okucia, Ceny_dostawcow nie powinny straszyć duplikatem producent+symbol.', check:()=> {
      const api = FC.hardwareCatalogImportExport, store = FC.catalogStore;
      if(!(api && store && typeof store.savePriceList === 'function')) return false;
      const previousAccessories = store.getAccessories ? store.getAccessories() : [], previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
      try{
        const existing = { id:'dup_same_1', manufacturer:'Blum', symbol:'DUP-SAME', name:'To samo okucie', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', status:'active', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, priceDate:'2026-05-12', priceStatus:'current', useForQuote:true }] };
        store.savePriceList('accessories', [existing]);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultVatRate:23, defaultDiscountPercent:0, active:true }]);
        const plan = api.buildImportPlan({ accessories:[existing], suppliers:[], settings:{}, supplierPriceRows:[{ __rowIndex:2, okucie_nazwa:'To samo okucie', okucie_symbol:'DUP-SAME', producent:'Blum', kategoria:'Zawiasy', jednostka:'szt.', dostawca:'MAGO', cena_netto:10, cena_brutto:12.3, data_ceny:'2026-05-12' }] }, { mode:'merge' });
        return plan.errors.length === 0 && !plan.warnings.some((msg)=> String(msg || '').includes('pasuje do kilku różnych okuć'));
      }finally{
        if(store.savePriceList) store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
      }
    } },
    { name:'Resolver ceny istniejącego okucia wymaga dostawcy z listy', explain:'Chroni import cenników: cena z producentem i symbolem istniejącego okucia, ale bez dostawcy, trafia do resolvera; po wyborze dostawcy aktualizuje cenę tego dostawcy, a ignorowanie liczy się jako pominięte.', check:()=> {
      const api = FC.hardwareCatalogImportExport, xlsx = FC.hardwareSupplierPriceXlsx, store = FC.catalogStore;
      if(!(api && xlsx && typeof xlsx.supplierPriceMissingSupplierGaps === 'function' && store && typeof store.savePriceList === 'function')) return false;
      const resolverSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-import-resolver.js'), 'utf8');
      const previousAccessories = store.getAccessories ? store.getAccessories() : [], previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
      try{
        const suppliers = [{ id:'mago', name:'MAGO', defaultVatRate:23, defaultDiscountPercent:0, active:true }, { id:'bivert', name:'Bivert', defaultVatRate:23, defaultDiscountPercent:0, active:true }];
        const existing = { id:'supplier_gap_existing', manufacturer:'Blum', symbol:'SUP-GAP', name:'Istniejące okucie', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', status:'active', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, priceDate:'2026-05-12', priceStatus:'current', useForQuote:false }] };
        store.savePriceList('accessories', [existing]);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(suppliers);
        const row = { __rowIndex:31, producent:'Blum', okucie_symbol:'SUP-GAP', cena_netto:11 };
        const gaps = xlsx.supplierPriceMissingSupplierGaps([row], [existing], suppliers);
        const skippedPlan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{}, supplierPriceRows:[Object.assign({}, row, { __skipImport:true })] }, { mode:'merge' });
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{}, supplierPriceRows:[Object.assign({}, row, { dostawca:'MAGO' })] }, { mode:'merge' });
        const updated = plan.next.accessories.find((item)=> String(item && item.id || '') === 'supplier_gap_existing');
        const price = updated && Array.isArray(updated.supplierPrices) ? updated.supplierPrices.find((priceRow)=> String(priceRow && priceRow.supplierId || '') === 'mago') : null;
        return gaps.length === 1
          && gaps[0].gaps.length === 1
          && gaps[0].gaps[0] === 'supplierName'
          && skippedPlan.summary.supplierPrices === 1
          && skippedPlan.summary.supplierPricesSkipped === 1
          && plan.summary.supplierPricesUpdated === 1
          && plan.summary.supplierPricesAdded === 0
          && price && Number(price.catalogPriceNet) === 11 && Number(price.catalogPriceGross) === 13.53
          && resolverSrc.includes('Ta cena pasuje do istniejącego okucia')
          && resolverSrc.includes('ignoreAllScope')
          && !resolverSrc.includes('Dodaj dostawcę');
      }finally{
        if(store.savePriceList) store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
      }
    } },
    { name:'Import cen dostawców pokazuje potwierdzenia nowych i aktualizowanych cen', explain:'Chroni przed cichą zmianą katalogu: plan importu niesie listę zmian cen, z rozróżnieniem dodania i aktualizacji oraz starą/nową ceną.', check:()=> {
      const api = FC.hardwareCatalogImportExport, store = FC.catalogStore, confirmUi = FC.priceModalHardwarePriceConfirm;
      if(!(api && store && typeof store.savePriceList === 'function' && confirmUi && typeof confirmUi.confirmSupplierPriceChanges === 'function')) return false;
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-price-confirm.js'), 'utf8');
      const previousAccessories = store.getAccessories ? store.getAccessories() : [], previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
      try{
        const item = { id:'confirm_price_hw', manufacturer:'Blum', symbol:'CONF-1', name:'Potwierdzane okucie', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', status:'active', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, priceDate:'2026-05-12', priceStatus:'current', useForQuote:true }] };
        store.savePriceList('accessories', [item]);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultVatRate:23, defaultDiscountPercent:0, active:true }, { id:'local', name:'Hurtownia lokalna', defaultVatRate:23, defaultDiscountPercent:0, active:true }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{}, supplierPriceRows:[
          { __rowIndex:41, producent:'Blum', okucie_symbol:'CONF-1', dostawca:'MAGO', cena_netto:11, data_ceny:'2026-05-13' },
          { __rowIndex:42, producent:'Blum', okucie_symbol:'CONF-1', dostawca:'Hurtownia lokalna', cena_netto:9, data_ceny:'2026-05-13' }
        ] }, { mode:'merge' });
        const changes = plan.summary.supplierPriceChanges || [];
        const updated = changes.find((row)=> row.action === 'updated');
        const added = changes.find((row)=> row.action === 'added');
        return plan.summary.supplierPricesUpdated === 1
          && plan.summary.supplierPricesAdded === 1
          && changes.length === 2
          && updated && updated.oldPrice && Number(updated.oldPrice.catalogPriceNet) === 10 && Number(updated.newPrice.catalogPriceNet) === 11 && updated.affectsQuote === true
          && added && !added.oldPrice && Number(added.newPrice.catalogPriceNet) === 9 && added.rawRow
          && src.includes('Zostaw starą') && src.includes('Dodaj wszystkie nowe ceny') && src.includes('Zaktualizuj wszystkie aktualizacje') && src.includes('Dodano') && src.includes('Zaktualizowano');
      }finally{
        if(store.savePriceList) store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
      }
    } },
    { name:'Podgląd importu cen nie zmienia katalogu przed zatwierdzeniem', explain:'Chroni stabilizację import/export: buildImportPlan ma liczyć plan zmian cen, ale nie może mutować aktualnego catalogStore.', check:()=> {
      const api = FC.hardwareCatalogImportExport, store = FC.catalogStore;
      if(!(api && store && typeof store.savePriceList === 'function' && typeof store.getAccessories === 'function')) return false;
      const previousAccessories = store.getAccessories ? store.getAccessories() : [], previousSuppliers = store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
      try{
        const item = { id:'purity_hw_1', manufacturer:'Blum', symbol:'PURE-1', name:'Test czystości planu', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', status:'active', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, priceDate:'2026-05-12', priceStatus:'current', useForQuote:true }] };
        store.savePriceList('accessories', [item]);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, defaultVatRate:8, active:true }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{ defaultVatRate:23 }, supplierPriceRows:[{ __rowIndex:50, producent:'Blum', okucie_symbol:'PURE-1', dostawca:'MAGO', cena_netto:11, data_ceny:'2026-05-13' }] }, { mode:'merge' });
        const stored = store.getAccessories()[0];
        const storedPrice = stored && Array.isArray(stored.supplierPrices) ? stored.supplierPrices[0] : null;
        const planned = plan.next.accessories.find((row)=> String(row && row.id || '') === 'purity_hw_1');
        const plannedPrice = planned && Array.isArray(planned.supplierPrices) ? planned.supplierPrices[0] : null;
        return plan.summary.supplierPricesUpdated === 1
          && storedPrice && Number(storedPrice.catalogPriceNet) === 10 && Number(storedPrice.catalogPriceGross) === 12.3
          && plannedPrice && Number(plannedPrice.catalogPriceNet) === 11 && Number(plannedPrice.catalogPriceGross) === 13.53;
      }finally{
        if(store.savePriceList) store.savePriceList('accessories', previousAccessories);
        if(store.saveHardwareSuppliers) store.saveHardwareSuppliers(previousSuppliers);
      }
    } },
    { name:'Resolver brakującego dostawcy działa mimo tego samego okucia w katalogu i arkuszu', explain:'Chroni realny eksport/import: Ceny_dostawcow z pustym albo śmieciowym dostawcą mają trafić do resolvera, nawet gdy to samo okucie jest równocześnie w aktualnym katalogu i w arkuszu Okucia.', check:()=> {
      const xlsx = FC.hardwareSupplierPriceXlsx;
      if(!(xlsx && typeof xlsx.supplierPriceMissingSupplierGaps === 'function')) return false;
      const existing = { id:'same_export_item_1', manufacturer:'GTV', symbol:'FCHC 110° + euro', name:'Zawias GTV 110° cichy domyk clip-on + eurowkręty', hardwareCategory:'Zawiasy', hardwareUnit:'kpl.' };
      const importedSame = Object.assign({}, existing);
      const suppliers = [{ id:'local', name:'Hurtownia lokalna', defaultVatRate:23, defaultDiscountPercent:0, active:true }];
      const rows = [
        { __rowIndex:22, okucie_nazwa:'14', okucie_symbol:'FCHC 110° + euro', producent:'GTV', kategoria:'14', jednostka:'14', dostawca:'14', cena_netto:65, cena_brutto:'14', data_ceny:'14', okucie_id:'14', dostawca_id:'14' }
      ];
      const gaps = xlsx.supplierPriceMissingSupplierGaps(rows, [existing, importedSame], suppliers);
      return gaps.length === 1 && gaps[0].rowIndex === 22 && gaps[0].gaps.includes('supplierName') && gaps[0].item && String(gaps[0].item.id || '') === 'same_export_item_1';
    } },
    { name:'Dynamiczne parametry techniczne okuć mają słownik i helpy', explain:'Chroni nową architekturę: kategorie mają własne parametry, typ/cecha powstaje z cech kluczowych, a opcje techniczne mają opisy pod ?.', check:()=> {
      const api = FC.hardwareTechnicalParams;
      const dictionariesSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-dictionaries.js'), 'utf8');
      const formSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-form.js'), 'utf8');
      if(!(api && Array.isArray(api.DEFAULT_DEFINITIONS) && typeof api.buildTypeLabel === 'function' && typeof api.compareParam === 'function')) return false;
      const hingeFields = api.fieldsForCategory(api.DEFAULT_DEFINITIONS, 'Zawiasy');
      const drawerFields = api.fieldsForCategory(api.DEFAULT_DEFINITIONS, 'Szuflady / prowadnice');
      const typeLabel = api.buildTypeLabel(api.DEFAULT_DEFINITIONS, 'Zawiasy', { nalozenie:{ value:'nakładany' }, kat_otwarcia:{ from:90, to:110 }, hamulec:{ value:true } });
      return hingeFields.some((row)=> row.key === 'kat_otwarcia' && row.compareMode === 'withinRange')
        && drawerFields.some((row)=> row.key === 'dlugosc_mm' && row.compareMode === 'equal')
        && drawerFields.some((row)=> row.key === 'nosnosc_kg' && row.compareMode === 'minGte')
        && typeLabel.includes('nakładany') && typeLabel.includes('90') && typeLabel.includes('110°')
        && dictionariesSrc.includes('Cecha kluczowa') && dictionariesSrc.includes('compareMode') && dictionariesSrc.includes('openHelp')
        && formSrc.includes('hardwareDynamicTechnicalFields') && formSrc.includes('readDynamicTechnicalParams');
    } },
    { name:'Parametry techniczne okuć nie zapisują [object Object]', explain:'Chroni backup i katalog: obiekty z launcherów/Exceli muszą zostać znormalizowane do tekstu, liczb albo zakresów.', check:()=> {
      const hw = FC.hardwareCatalog;
      if(!(hw && typeof hw.normalizeAccessory === 'function')) return false;
      const row = hw.normalizeAccessory({
        id:'smoke_object_object_1', manufacturer:'Blum', name:'Zawias smoke', hardwareCategory:'Zawiasy', hardwareUnit:'szt.',
        technicalParams:{
          nalozenie:{ value:{ value:'nakładany', label:'Nakładany' } },
          kat_otwarcia:{ from:{ value:'90' }, to:{ label:'110' } },
          hamulec:{ value:{ value:true } }
        }
      }, ()=> 'smoke_object_object_1', { defaultVatRate:23, hardwareSuppliers:[] });
      const raw = JSON.stringify(row);
      return raw.indexOf('[object Object]') === -1
        && row.technicalParams && row.technicalParams.nalozenie && row.technicalParams.nalozenie.value === 'nakładany'
        && Number(row.technicalParams.kat_otwarcia.from) === 90
        && Number(row.technicalParams.kat_otwarcia.to) === 110
        && String(row.hardwareType || '').includes('nakładany')
        && String(row.hardwareType || '').includes('110°');
    } },
    { name:'Modal edycji okuć używa pasywnego odczytu stanu formularza', explain:'Chroni wydajność na telefonie: sprawdzanie brudnego formularza i zamykanie modala nie może remountować launchera Typ/Cecha ani przeliczać UI z efektami ubocznymi.', check:()=> {
      const itemFormSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-item-form.js'), 'utf8');
      const hardwareFormSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-form.js'), 'utf8');
      return itemFormSrc.includes('getCurrentAccessoryDraft({ passive:true })')
        && hardwareFormSrc.includes('const cfg = Object.assign({ passive:false }')
        && hardwareFormSrc.includes('syncHardwareTypeFromTechnicalParams({ updateAction:false, remountChoice:false })')
        && hardwareFormSrc.includes("updateChoiceLauncherLabel(select, 'hardwareTypeLaunch', 'Typ / cecha')")
        && !hardwareFormSrc.includes('function syncHardwareTypeFromTechnicalParams(){');
    } },
    { name:'Modal edycji okuć ma podgląd zamienników pod Wyjdź bez zapisu zmian', explain:'Chroni nowy etap: lista zamienników jest tylko podglądem w edycji okucia, ma własny moduł UI i nie dodaje zapisu do storage.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const itemFormSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-item-form.js'), 'utf8');
      const ui = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-replacements.js'), 'utf8');
      return html.includes('id="hardwareReplacementToggleBtn"')
        && html.includes('id="hardwareReplacementPreview"')
        && html.includes('price-modal-hardware-replacements.js')
        && itemFormSrc.includes('priceModalHardwareReplacements.updateActionState')
        && itemFormSrc.includes('priceModalHardwareReplacements.setSourceItem')
        && ui.includes('FC.priceModalHardwareReplacements')
        && ui.includes('previewRows')
        && ui.includes('Bez zapisu zmian')
        && !ui.includes('localStorage')
        && !ui.includes('savePriceList')
        && !/\b(alert|confirm|prompt)\s*\(/.test(ui);
    } },
    { name:'Słowniki okuć i Wzorce UI trzymają akordeon ROZRYS z ruchem', explain:'Chroni UX na telefonie: wspólny akordeon kategorii ma chevron jak ROZRYS, wzorzec UI pokazuje płynne otwarcie, a parametry nie tworzą małego wewnętrznego scrolla.', check:()=> {
      const dictionariesSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/material/price-modal-hardware-dictionaries.js'), 'utf8');
      const css = fs.readFileSync(path.join(process.cwd(), 'css/price-item-popup.css'), 'utf8');
      const uiPatterns = fs.readFileSync(path.join(process.cwd(), 'dev_ui_patterns.html'), 'utf8');
      return dictionariesSrc.includes('panel-box-form__scroll hardware-dictionary-scroll')
        && dictionariesSrc.includes('hardware-dictionary-param-list')
        && dictionariesSrc.includes('hardware-dictionary-categories-card')
        && dictionariesSrc.includes('hardware-dictionary-section-summary')
        && dictionariesSrc.includes('hardware-dictionary-section-chevron')
        && dictionariesSrc.includes('setSectionAccordionVisualState')
        && dictionariesSrc.includes('animateSectionAccordionOpen')
        && dictionariesSrc.includes('animateSectionAccordionClose')
        && dictionariesSrc.includes('setCategoriesAccordionOpen')
        && !dictionariesSrc.includes('hardware-section-static-open')
        && dictionariesSrc.includes("h('div', { class:'hardware-dictionary-categories-card is-open' })")
        && dictionariesSrc.includes("class:'hardware-dictionary-categories-body'")
        && !dictionariesSrc.includes("class:'hardware-dictionary-category-section-body'")
        && dictionariesSrc.includes("event.preventDefault();")
        && !dictionariesSrc.includes("categoriesSection.open = !!open")
        && dictionariesSrc.includes('closePeerCategoryAccordions')
        && dictionariesSrc.includes('toggleTechCategoryAccordion')
        && dictionariesSrc.includes("class:'hardware-tech-param-list'")
        && dictionariesSrc.includes("class:'hardware-tech-param-accordion'")
        && dictionariesSrc.includes('hardware-tech-param-summary__meta')
        && dictionariesSrc.includes('paramSummaryParts(item).join')
        && dictionariesSrc.includes('closePeerAccordions')
        && dictionariesSrc.includes('closingPeerAccordions')
        && dictionariesSrc.includes('scrollParamAccordionIntoView')
        && dictionariesSrc.includes('preserveActiveParamPosition')
        && dictionariesSrc.includes('afterDictionaryLayout')
        && dictionariesSrc.includes('targetScrollTopForParam')
        && dictionariesSrc.includes('scrollParamHeaderBeforeToggle')
        && dictionariesSrc.includes('waitForParamScroll')
        && dictionariesSrc.includes('paramOpenSequence')
        && dictionariesSrc.includes('Najpierw płynnie dojedź do zwiniętego nagłówka')
        && !dictionariesSrc.includes('visibleBottom = scrollerRect.bottom')
        && dictionariesSrc.includes("node.closest('.hardware-dictionary-scroll, .panel-box-form__scroll')")
        && dictionariesSrc.includes("scroller.scrollTo({ top:nextTop, behavior:'smooth' })")
        && !dictionariesSrc.includes('hardware-dictionary-list hardware-tech-param-list')
        && css.includes('.hardware-dictionary-scroll')
        && css.includes('.hardware-dictionary-list{display:grid;gap:10px;max-height:none;overflow:visible')
        && css.includes('.hardware-dictionary-categories-card')
        && css.includes('.hardware-dictionary-section-chevron')
        && css.includes('.hardware-dictionary-section-body')
        && css.includes('.hardware-dictionary-section-body[hidden]{display:none!important;}')
        && css.includes('.hardware-dictionary-section-accordion.hardware-section-animating')
        && css.includes('.hardware-dictionary-section-accordion.rozrys-material-accordion.is-open')
        && css.includes('.hardware-dictionary-categories-body')
        && css.includes('.hardware-dictionary-categories-card > .hardware-dictionary-categories-body[hidden]')
        && css.includes('wspólny panel kategorii bez details/max-height')
        && !css.includes('.hardware-dictionary-categories-accordion:not([open])')
        && css.includes('max-height:none!important')
        && css.includes('height:auto!important')
        && css.includes('transition:none!important')
        && css.includes('overflow:visible!important')
        && css.includes('.hardware-tech-param-list{display:grid;gap:10px;max-height:none;overflow:visible')
        && css.includes('.hardware-supplier-actions.hardware-dictionary-actions{margin-top:0;}')
        && css.includes('.hardware-tech-param-accordion')
        && css.includes('.hardware-tech-param-summary__meta')
        && css.includes('#priceModal .hardware-tech-param-row .grid-3')
        && css.includes('{grid-template-columns:1fr;}')
        && uiPatterns.includes('Accordion ROZRYS + ruch')
        && uiPatterns.includes('data-ui-pattern-accordion-group')
        && uiPatterns.includes('natychmiastowe zamykanie starej sekcji i płynne rozwijanie nowej')
        && uiPatterns.includes('rozrys-material-accordion__chevron')
        && uiPatterns.includes('is-ui-pattern-animating');
    } },
    { name:'Słownik okuć renderuje treść akordeonu kategorii po otwarciu', explain:'Chroni regresję z telefonu: wspólny akordeon `Kategorie / rodzaje okuć` nie może otwierać się jako pusta ramka; lista kategorii ma zostać w body po zamknięciu i ponownym otwarciu.', check:()=> {
      let captured = null;
      const oldPanelBox = FC.panelBox;
      const oldMatchMedia = sandbox.window.matchMedia;
      try{
        sandbox.window.matchMedia = ()=>({ matches:true });
        FC.panelBox = { open:(opts)=>{ captured = opts; }, close:()=>{} };
        if(!(FC.priceModalHardwareDictionaries && typeof FC.priceModalHardwareDictionaries.open === 'function')) return false;
        FC.priceModalHardwareDictionaries.open();
        const content = captured && captured.contentNode;
        const section = content && content.querySelector('.hardware-dictionary-categories-card');
        const summary = content && content.querySelector('.hardware-dictionary-section-summary');
        const body = content && content.querySelector('.hardware-dictionary-categories-body');
        const legacyBody = content && (content.querySelector('.hardware-dictionary-category-section-body') || content.querySelector('.hardware-dictionary-categories-body.hardware-dictionary-section-body') || content.querySelector('.hardware-dictionary-categories-body.rozrys-material-accordion__body'));
        const list = content && content.querySelector('.hardware-dictionary-category-list');
        const firstInput = list && list.querySelector('input');
        const initialRows = list && list.querySelectorAll('.hardware-dictionary-row');
        const addButton = body && Array.from(body.querySelectorAll('button')).find((btn)=> /Dodaj kategorię/.test(btn.textContent || ''));
        const bodyNotClipped = ()=> body && body.hidden === false && body.classList.contains('hardware-dictionary-categories-body') && !body.classList.contains('hardware-dictionary-section-body') && !body.classList.contains('rozrys-material-accordion__body') && body.style.maxHeight !== '0px' && body.style.maxHeight !== '1px' && body.style.overflow !== 'hidden';
        const hasRealCategoryContent = ()=> {
          const rows = list && list.querySelectorAll('.hardware-dictionary-row');
          const input = list && list.querySelector('input');
          const removeButton = list && Array.from(list.querySelectorAll('button')).find((btn)=> /Usuń/.test(btn.textContent || ''));
          return !!(rows && rows.length >= 3 && input && input.value === 'Zawiasy' && removeButton && addButton);
        };
        const initiallyVisible = !!(section && summary && body && !legacyBody && list && bodyNotClipped() && hasRealCategoryContent() && summary.getAttribute('aria-expanded') === 'true');
        if(!initiallyVisible) return false;
        summary.click();
        const closed = body.hidden === true && summary.getAttribute('aria-expanded') === 'false' && section.classList.contains('is-open') === false;
        summary.click();
        const reopenedRows = list.querySelectorAll('.hardware-dictionary-row');
        const reopened = bodyNotClipped() && body.hidden === false && summary.getAttribute('aria-expanded') === 'true' && section.classList.contains('is-open') === true && reopenedRows.length >= initialRows.length && hasRealCategoryContent();
        return closed && reopened;
      }finally{
        FC.panelBox = oldPanelBox;
        sandbox.window.matchMedia = oldMatchMedia;
      }
    } },
    { name:'Arkusz składu zestawów ma czytelne kolumny i ID na końcu', explain:'Chroni XLSX przed powrotem do układu zaczynającego się od technicznych ID.', check:()=> {
      const api = FC.hardwareCatalogImportExport;
      if(!(api && api._debug && typeof api._debug.buildBundleRows === 'function')) return false;
      const rows = api._debug.buildBundleRows([
        { id:'bundle1', name:'Zestaw testowy', symbol:'ZT', bundleItems:[{ itemId:'part1', qty:2 }] },
        { id:'part1', name:'Składnik testowy', symbol:'ST', hardwareUnit:'szt.', manufacturer:'Blum', hardwareCategory:'Zawiasy' }
      ]);
      const headers = rows[0] || [];
      return headers[0] === 'zestaw_nazwa' && headers[1] === 'skladnik_nazwa' && headers[2] === 'ilosc' && headers[headers.length - 2] === 'zestaw_id' && headers[headers.length - 1] === 'skladnik_id' && rows[1][0] === 'Zestaw testowy' && rows[1][1] === 'Składnik testowy' && rows[1][5] === 'szt.';
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
    { name:'Wycena core ma spójny świeży cache-busting', explain:'Chroni pierwsze odświeżenie po wdrożeniu przed mieszaniem starych i nowych modułów wycena-core*.', check:()=> {
      const legacyBaseExpected = '20260510_wycena_core_cache_fix_v1';
      const legacyChangedExpected = '20260524_hardware_producer_preferences_v1';
      const newerExpected = '20260529_wycena_context_richer_source_fix_v1';
      const currentExpected = '20260530_wycena_duplicate_modal_fix_v1';
      const registerExpected = '20260531_quote_calculation_register_v1';
      const detailsModalExpected = '20260601_quote_details_modal_ui_hardware_match_fix_v1';
      const auditMaterialsExpected = '20260601_quote_audit_material_quantities_fix_v1';
      const pcvTruthExpected = '20260601_pcv_single_source_truth_v1';
      const hingeCatalogExpected = '20260603_hinge_catalog_requirement_options_v1';
      const files = ['index.html','dev_tests.html'];
      const scripts = ['wycena-core-selection.js','wycena-core-utils.js','wycena-core-catalog.js','wycena-core-source.js','wycena-core-material-plan.js','wycena-core-offer.js','wycena-core-lines.js','wycena-core-labor.js','wycena-core.js'];
      return files.every((file)=> {
        const html = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
        return scripts.every((script)=> {
          const legacyExpected = script === 'wycena-core-lines.js' ? legacyChangedExpected : legacyBaseExpected;
          return html.includes(`js/app/wycena/${script}?v=${legacyExpected}`) || html.includes(`js/app/wycena/${script}?v=${newerExpected}`) || html.includes(`js/app/wycena/${script}?v=${currentExpected}`) || html.includes(`js/app/wycena/${script}?v=${registerExpected}`) || html.includes(`js/app/wycena/${script}?v=${detailsModalExpected}`) || html.includes(`js/app/wycena/${script}?v=${auditMaterialsExpected}`) || html.includes(`js/app/wycena/${script}?v=${pcvTruthExpected}`) || html.includes(`js/app/wycena/${script}?v=${hingeCatalogExpected}`);
        });
      });
    } },
    { name:'Wycena czyta preferencję producenta okuć z WYWIADU', explain:'Pierwszy most WYWIAD → WYCENA: uproszczone linie okuć używają producenta ustawionego w preferencjach pomieszczenia, bez zapisu zamian do projektu.', check:()=> {
      if(!(FC.wycenaCoreLines && typeof FC.wycenaCoreLines.collectAccessories === 'function' && FC.cabinetCutlist && typeof FC.cabinetCutlist.getCabinetCutList === 'function')) return false;
      const previousProject = sandbox.projectData;
      const previousCutlist = FC.cabinetCutlist.getCabinetCutList;
      try{
        sandbox.projectData = {
          schemaVersion:9,
          kuchnia:{
            cabinets:[{ id:'cab_hw_pref_smoke', width:60, height:72, depth:51, type:'stojąca', subType:'standardowa', details:{} }],
            fronts:[], sets:[], settings:{},
            preferences:{ hardwareProducers:{ hinges:'GTV' } }
          }
        };
        FC.cabinetCutlist.getCabinetCutList = ()=> [{ name:'Smoke okucie', material:'Okucia: zawiasy BLUM', qty:3, a:0, b:0 }];
        const rows = FC.wycenaCoreLines.collectAccessories(['kuchnia']);
        return Array.isArray(rows) && rows.some((row)=> row && row.name === 'zawiasy GTV' && Number(row.qty) === 3);
      }finally{
        FC.cabinetCutlist.getCabinetCutList = previousCutlist;
        sandbox.projectData = previousProject;
      }
    } },
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
    { name:'Model preferencji pokoju jest dostępny', explain:'Chroni Etap 1B preferencji strefowych oraz preferencji producentów okuć w WYWIADZIE.', check:()=> !!(FC.roomPreferences && typeof FC.roomPreferences.normalizeRoomPreferences === 'function' && typeof FC.roomPreferences.applyPreferencesToDraft === 'function' && typeof FC.roomPreferences.getZonePreferences === 'function' && typeof FC.roomPreferences.resolveHardwareProducerPreference === 'function' && typeof FC.roomPreferences.getHardwareProducerSummary === 'function' && Array.isArray(FC.roomPreferences.ZONE_KEYS) && FC.roomPreferences.ZONE_KEYS.length === 3 && Array.isArray(FC.roomPreferences.HARDWARE_PRODUCER_GROUPS) && FC.roomPreferences.HARDWARE_PRODUCER_GROUPS.length === 5) },
    { name:'Resolver strefowych materiałów jest centralnym kontraktem', explain:'Chroni Etap 1C.2: logika strefa → trybik → fallback ma jedno API zamiast powielonych ścieżek w nowych funkcjach.', check:()=> {
      const apiOk = !!(FC.roomPreferences
        && typeof FC.roomPreferences.resolveZoneDefaults === 'function'
        && typeof FC.roomPreferences.resolveZoneFrontMaterial === 'function'
        && typeof FC.roomPreferences.applyZoneDefaultsToDraft === 'function');
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/room-preferences/room-preferences-model.js'), 'utf8');
      return apiOk
        && src.includes('function resolveZoneDefaults(room, zoneOrType, fallback)')
        && src.includes('getProgramMaterialDefaults()')
        && src.includes('applyMaterialFields(resolved, zone)')
        && src.includes('function resolveZoneFrontMaterial(room, zoneOrType, fallback)');
    } },
    { name:'Drafty i zestawy używają centralnego resolvera stref', explain:'Chroni kod przed dublowaniem logiki materiałów między nową szafką, zestawem i źródłami frontu.', check:()=> {
      const draftSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-draft.js'), 'utf8');
      const wizardSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-set-wizard.js'), 'utf8');
      const frontSourceSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/front-material-source.js'), 'utf8');
      return draftSrc.includes('applyZoneDefaultsToDraft(room, draft, type)')
        && wizardSrc.includes("resolveZoneDefaults(room, 'lower', fallback)")
        && frontSourceSrc.includes('resolveZoneFrontMaterial(room, zone, {})');
    } },
    { name:'Preferencje WYWIADU używają stref i launcherów aplikacji', explain:'Chroni UI przed powrotem do płaskich preferencji, natywnych selectów i sekcji Domyślne w WYWIADZIE.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/wywiad-room-preferences.js'), 'utf8');
      const hardwareSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/wywiad-room-hardware-producers.js'), 'utf8');
      const settingsSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/wywiad-room-settings.js'), 'utf8');
      const actionsSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/wywiad-room-accordion-actions.js'), 'utf8');
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      return actionsSrc.includes('createSaveFooter')
        && settingsSrc.includes("createSaveFooter('Parametry pomieszczenia'")
        && settingsSrc.includes('applySettingsValues(room, buildPreviewSettings(inputs))')
        && (src.includes('Strefa dolna / stojące')
        || (src.includes('buildZoneCard') && src.includes('wywiad-zone-choice') && src.includes('openRozrysChoiceOverlay') && !src.includes("document.createElement('select')")))
        && hardwareSrc.includes('getHardwareManufacturers')
        && hardwareSrc.includes('openRozrysChoiceOverlay')
        && hardwareSrc.includes('Zapisz zmiany')
        && hardwareSrc.includes('Pozostałe akcesoria')
        && !hardwareSrc.includes("document.createElement('select')")
        && !hardwareSrc.includes("h('select'")
        && html.includes('id="roomHardwareProducerPreferencesAccordion"')
        && html.includes('Preferencje producentów okuć')
        && html.includes('Preferencje materiałów i kolorów');
    } },
    { name:'Źródło materiału frontów jest dostępne dla lodówek i zestawów', explain:'Chroni Etap 1C: front specjalny może wskazywać dolną/środkową/górną strefę albo własny materiał bez zgadywania po wysokości.', check:()=> {
      const apiOk = !!(FC.frontMaterialSource && typeof FC.frontMaterialSource.resolveFridgeFront === 'function' && typeof FC.frontMaterialSource.resolveSetFront === 'function');
      const fridgeSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-standing-specials.js'), 'utf8');
      const setSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-set-wizard.js'), 'utf8');
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      return apiOk
        && fridgeSrc.includes('makeFridgeSourceKey')
        && fridgeSrc.includes('appendFridgeFrontSourceField')
        && setSrc.includes('setFrontSource')
        && html.includes('id="setFrontSource"');
    } },
    { name:'Zestawy mają ujednolicone materiały, plecy i otwieranie', explain:'Chroni set-wizard przed powrotem do samych frontów: zestaw ma mieć korpus, plecy, otwieranie i fronty jak zwykłe szafki.', check:()=> {
      const apiOk = !!(FC.cabinetModalSetMaterials && typeof FC.cabinetModalSetMaterials.populateSelectors === 'function' && typeof FC.cabinetModalSetMaterials.getSpec === 'function');
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const wizard = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-set-wizard.js'), 'utf8');
      return apiOk
        && html.includes('id="setBodyColor"')
        && html.includes('id="setBackMaterial"')
        && html.includes('id="setOpeningSystem"')
        && wizard.includes('setMaterials.bodyColor')
        && wizard.includes('setMaterials.backMaterial')
        && wizard.includes('setMaterials.openingSystem');
    } },
    { name:'Lodówka nie pokazuje zdublowanych pól frontu', explain:'Chroni UI lodówki: nowe źródła materiału frontu zastępują stare ogólne pola Materiał Frontu / Kolor Frontu, ale korpus/plecy/otwieranie zostają.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const modal = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal.js'), 'utf8');
      return html.includes('id="cmFrontMaterialWrap"')
        && html.includes('id="cmFrontColorWrap"')
        && modal.includes('function isFridgeCabinetDraft')
        && modal.includes('syncCabinetMaterialVisibility(draft)')
        && modal.includes("hideGeneralFrontFields ? 'none'");
    } },
    { name:'Zestaw startuje z materiałów dolnej strefy', explain:'Chroni decyzję UX: korpus, plecy i otwieranie zestawu mają startować jak szafki stojące/dolne, nie z ostatniego losowego typu szafki.', check:()=> {
      const wizard = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-set-wizard.js'), 'utf8');
      return wizard.includes('function getLowerZoneMaterialDefaults')
        && wizard.includes("resolveZoneDefaults(room, 'lower', fallback)")
        && wizard.includes('function getSetBaseDraft(room)')
        && !/function getSetBaseDraft\(room\)\{\s*const base = makeDefaultCabinetDraftForRoom\(room\)/.test(wizard);
    } },
    { name:'Etap 2A ma plan i apply preferencji strefowych', explain:'Chroni hurtowe zastosowanie preferencji: najpierw plan zmian/liczniki, potem zatwierdzony apply bez systemowych okien.', check:()=> {
      const planSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/room-preferences/room-preferences-bulk-plan.js'), 'utf8');
      const applySrc = fs.readFileSync(path.join(process.cwd(), 'js/app/room-preferences/room-preferences-bulk-apply.js'), 'utf8');
      const uiSrc = fs.readFileSync(path.join(process.cwd(), 'js/app/ui/wywiad-room-preferences-bulk-modal.js'), 'utf8');
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      return !!(FC.roomPreferencesBulkPlan && typeof FC.roomPreferencesBulkPlan.buildPlan === 'function'
        && FC.roomPreferencesBulkApply && typeof FC.roomPreferencesBulkApply.apply === 'function'
        && FC.wywiadRoomPreferencesBulk && typeof FC.wywiadRoomPreferencesBulk.open === 'function')
        && planSrc.includes('function buildPlan(room, selection)')
        && applySrc.includes('function apply(room, selection)')
        && uiSrc.includes('Zastosuj preferencje do szafek')
        && uiSrc.includes('aria-pressed')
        && !uiSrc.includes("document.createElement('select')")
        && !uiSrc.includes('confirm(')
        && html.includes('room-preferences-bulk-plan.js')
        && html.includes('wywiad-room-preferences-bulk-modal.js');
    } },
    { name:'Launchery szafki synchronizują draft także przy wyborze tej samej wartości', explain:'Chroni błąd z dev_tests.html: jeśli select ma już wartość z renderu, kliknięcie launchera nadal musi odpalić onchange i zsynchronizować draft.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-choice-launchers.js'), 'utf8');
      return src.includes('Nawet wybór tej samej wartości musi zsynchronizować draft')
        && src.includes('if(picked == null) return;')
        && !src.includes("String(picked) === String(selectEl.value || '')")
        && src.includes("selectEl.dispatchEvent(new Event('change', { bubbles:true }))");
    } },
    { name:'Modal szafki ma dodatki robocizny', explain:'Pilnuje wyboru usług dodatkowych z katalogu robocizny przy konkretnej szafce.', check:()=> !!(FC.cabinetModalLabor && typeof FC.cabinetModalLabor.renderLaborSection === 'function' && typeof FC.cabinetModalLabor.getDefinitions === 'function') },
    { name:'WYWIAD pokazuje zapisane dodatki robocizny szafki', explain:'Chroni podgląd dodatków robocizny na karcie szafki w WYWIADZIE.', check:()=> {
      const api = FC.wywiadLaborSummary;
      if(!(api && typeof api.getHeaderText === 'function' && typeof api.getHeaderLines === 'function' && typeof api.renderHeaderSummary === 'function' && typeof api.renderCabinetLaborSummary === 'function')) return false;
      const cab = { type:'wisząca', subType:'okap', details:{ applianceMountingMode:'none' }, laborItems:[{ rateId:'labor_hole_fi60', qty:2 }, { rateId:'labor_custom_extra', qty:1 }] };
      const header = api.getHeaderText(cab);
      const lines = api.getHeaderLines(cab);
      const headerNode = api.renderHeaderSummary(cab);
      const node = api.renderCabinetLaborSummary(cab);
      const mountOff = headerNode && headerNode.querySelector('.cabinet-header__labor-line--mount-off');
      const laborLines = headerNode ? headerNode.querySelectorAll('.cabinet-header__labor-line--item') : [];
      return /Otwór fi 60/.test(header)
        && !/×2/.test(header)
        && !/×3/.test(header)
        && /bez montażu/.test(header)
        && lines.length === 3
        && !!(mountOff && /bez montażu/.test(mountOff.textContent || ''))
        && laborLines.length === 2
        && !!(node && node.textContent && /Otwór fi 60/.test(node.textContent) && /bez montażu/.test(node.textContent));
    } },
    { name:'WYWIAD koloruje status montażu sprzętu w nagłówku szafki', explain:'Pilnuje czerwonego statusu bez montażu i zielonego statusu z montażem bez zmiany układu czcionek.', check:()=> {
      const api = FC.wywiadLaborSummary;
      if(!(api && typeof api.renderHeaderSummary === 'function')) return false;
      const offNode = api.renderHeaderSummary({ type:'stojąca', subType:'piekarnikowa', details:{ applianceMountingMode:'none' }, laborItems:[] });
      const onNode = api.renderHeaderSummary({ type:'stojąca', subType:'piekarnikowa', details:{ applianceMountingMode:'mount' }, laborItems:[] });
      const css = fs.readFileSync(path.join(process.cwd(), 'css/wywiad.css'), 'utf8');
      return !!(offNode && offNode.querySelector('.cabinet-header__labor-line--mount-off') && onNode && onNode.querySelector('.cabinet-header__labor-line--mount-on'))
        && css.includes('.cabinet-header__labor-line--mount-off{color:#dc2626;}')
        && css.includes('.cabinet-header__labor-line--mount-on{color:#16a34a;}')
        && css.includes('.cabinet-header__labor-line--item{color:#f97316;}');
    } },
    { name:'Modal szafki ma robociznę po parametrach i materiałach', explain:'Chroni kolejność: najpierw typ, wymiary i materiały szafki, dopiero potem dodatkowe czynności.', check:()=> {
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      return html.indexOf('id="cmOpeningSystem"') > -1 && html.indexOf('id="cmLaborAddons"') > html.indexOf('id="cmOpeningSystem"') && html.indexOf('id="cmLaborAddons"') > html.indexOf('id="cmBodyColor"');
    } },
    { name:'Montaż sprzętu w modalu szafki używa chipów z ptaszkiem', explain:'Chroni wybór Z montażem / Bez montażu przed powrotem do zwykłych przycisków.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-labor.js'), 'utf8');
      return src.includes("make('label', `rozrys-scope-chip cabinet-labor-appliance__choice") && src.includes("cb.type = 'checkbox'") && src.includes('api.setMountingMode(draft, opt.value)') && !src.includes("make('button', `rozrys-scope-chip cabinet-labor-appliance__choice");
    } },
    { name:'Reguły techniczne zawiasów szafek są dostępne', explain:'Chroni etap szafka → wymagania okucia przed dobieraniem konkretnego produktu katalogowego.', check:()=> {
      const api = FC.cabinetHardwareRequirements;
      if(!(api && typeof api.getBaseHingeRequirement === 'function' && typeof api.getHingeRequirementWithQty === 'function')) return false;
      const room = { cabinets:[] };
      const reqStd = api.getBaseHingeRequirement(room, { type:'stojąca', subType:'standard', width:60, height:82, frontCount:1, details:{} });
      const reqL = api.getBaseHingeRequirement(room, { type:'stojąca', subType:'narozna_l', width:90, height:82, frontCount:2, details:{} });
      const reqBlind = api.getBaseHingeRequirement(room, { type:'wisząca', subType:'rogowa_slepa', width:90, height:72, frontCount:1, details:{} });
      const reqOvenDrawer = api.getBaseHingeRequirement(room, { type:'stojąca', subType:'piekarnikowa', details:{ ovenOption:'szuflada_dol' } });
      const reqOvenFlap = api.getBaseHingeRequirement(room, { type:'stojąca', subType:'piekarnikowa', details:{ ovenOption:'klapka_dol' } });
      const reqSinkDrawer = api.getBaseHingeRequirement(room, { type:'stojąca', subType:'zlewowa', details:{ sinkFront:'szuflada' } });
      const reqUnderDoors = api.getBaseHingeRequirement(room, { type:'wisząca', subType:'dolna_podblatowa', details:{ podFrontMode:'drzwi' } });
      const reqUnderDrawers = api.getBaseHingeRequirement(room, { type:'wisząca', subType:'dolna_podblatowa', details:{ podFrontMode:'szuflady' } });
      const reqFridgeDefault = api.getBaseHingeRequirement(room, { type:'stojąca', subType:'lodowkowa', details:{ fridgeOption:'zabudowa' } });
      const reqFridgeChecked = api.getBaseHingeRequirement(room, { type:'stojąca', subType:'lodowkowa', details:{ fridgeOption:'zabudowa', requiresFurnitureHinges:true } });
      return reqStd.typeId === 'hinge_110_overlay'
        && reqL.typeId === 'hinge_170_corner'
        && reqBlind.typeId === 'hinge_parallel_inset' && reqBlind.label === 'Zawias równoległy wpuszczany' && reqBlind.technicalParams && reqBlind.technicalParams.nalozenie && reqBlind.technicalParams.nalozenie.value === 'równoległy wpuszczany'
        && reqOvenDrawer.kind === 'none'
        && reqOvenFlap.typeId === 'hinge_110_overlay'
        && reqSinkDrawer.kind === 'none'
        && reqUnderDoors.typeId === 'hinge_110_overlay' && reqUnderDoors.logicalGroup === 'stojąca_bez_nóg'
        && reqUnderDrawers.kind === 'none'
        && reqFridgeDefault.kind === 'none' && reqFridgeDefault.canEnableWithFlag === 'requiresFurnitureHinges'
        && reqFridgeChecked.typeId === 'hinge_fridge_overlay' && reqFridgeChecked.technicalParams && reqFridgeChecked.technicalParams.nalozenie && reqFridgeChecked.technicalParams.nalozenie.value === 'lodówkowy nakładany';
    } },
    { name:'Modal szafki pokazuje panel wymagań technicznych bez produktów katalogowych', explain:'Chroni etap WYWIAD → WYCENA: użytkownik widzi cechy techniczne szafki, a nie producenta/model dobrany dopiero w WYCENIE.', check:()=> {
      const api = FC.cabinetHardwareRequirementsPanel;
      if(!(api && typeof api.renderPanel === 'function')) return false;
      const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const modal = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal.js'), 'utf8');
      const container = { innerHTML:'' };
      api.renderPanel(container, 'kuchnia', { type:'stojąca', subType:'standard', width:60, height:82, depth:51, frontCount:2, frontMaterial:'laminat', details:{} });
      return html.includes('id="cmHardwareRequirements"')
        && html.includes('cabinet-hardware-requirements-panel.js?v=20260603_hinge_catalog_requirement_options_v1')
        && modal.includes('cabinetHardwareRequirementsPanel')
        && container.innerHTML.includes('Wymagania techniczne do wyceny')
        && container.innerHTML.includes('nakładany')
        && container.innerHTML.includes('min. 110°')
        && !/\bBLUM\b|\bBlum\b|\bGTV\b/.test(container.innerHTML);
    } },
    { name:'UI lodówki ma ptaszek zawiasów meblowych', explain:'Chroni decyzję: lodówkowa domyślnie nie dostaje zawiasów, ale front może wymagać zawiasów meblowych.', check:()=> {
      const src = fs.readFileSync(path.join(process.cwd(), 'js/app/cabinet/cabinet-modal-standing-specials.js'), 'utf8');
      return src.includes('appendFridgeFurnitureHingeToggle')
        && src.includes('requiresFurnitureHinges')
        && src.includes('Wymaga zawiasów meblowych')
        && src.includes("cb.type = 'checkbox'");
    } },
    { name:'Lodówka z jednym dużym frontem liczy jeden front do zawiasów', explain:'Chroni zgłoszoną regresję: lodówkowa z ustawieniem 1 front nie może liczyć zawiasów jak dwa fronty góra/dół.', check:()=> {
      const hw = FC.frontHardware;
      if(!(hw && typeof hw.getCabinetFrontCutListForMaterials === 'function' && typeof hw.getHingeCountForCabinet === 'function' && typeof hw.blumHingesPerDoor === 'function')) return false;
      const previousProject = sandbox.projectData;
      try{
        sandbox.projectData = { schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ legHeight:10, bottomHeight:82 } } };
        const cabOne = { id:'fridge_one', type:'stojąca', subType:'lodowkowa', width:60, height:200, frontMaterial:'laminat', details:{ fridgeOption:'zabudowa', fridgeFrontCount:'1', requiresFurnitureHinges:true } };
        const cabTwo = { id:'fridge_two', type:'stojąca', subType:'lodowkowa', width:60, height:200, frontMaterial:'laminat', details:{ fridgeOption:'zabudowa', fridgeFrontCount:'2', requiresFurnitureHinges:true } };
        const oneParts = hw.getCabinetFrontCutListForMaterials('kuchnia', cabOne);
        const twoParts = hw.getCabinetFrontCutListForMaterials('kuchnia', cabTwo);
        const expectedOne = hw.blumHingesPerDoor(60, 190, 'laminat', true);
        return oneParts.length === 1
          && oneParts[0].qty === 1
          && oneParts[0].a === 60
          && oneParts[0].b === 190
          && twoParts.length === 2
          && twoParts.some((part)=> part.b === 72)
          && twoParts.some((part)=> part.b === 118)
          && hw.getHingeCountForCabinet('kuchnia', cabOne) === expectedOne;
      }finally{
        sandbox.projectData = previousProject;
      }
    } },
    { name:'Katalog okuć ma słownikowe typy zawiasów bez sztywnego opisu rogowej ślepej', explain:'Chroni zasadę: okucie wynika ze słowników i katalogu, a rogowa ślepa używa realnej cechy równoległy wpuszczany.', check:()=> {
      const api = FC.hardwareCatalog;
      const tech = FC.hardwareTechnicalParams;
      if(!(api && tech && typeof api.normalizeTypeList === 'function' && typeof tech.normalizeDefinitions === 'function')) return false;
      const types = api.normalizeTypeList([{ id:'hinge_blind_corner', name:'Do rogowej ślepej / ślepego narożnika', allowedCategories:['Zawiasy'], active:true }, { id:'hinge_fridge', name:'Lodówkowy / do frontu lodówki', allowedCategories:['Zawiasy'], active:true }]);
      const params = tech.normalizeDefinitions([{ category:'Zawiasy', key:'nalozenie', label:'Nałożenie', fieldType:'text', options:['nakładany','półnakładany / bliźniaczy','wpuszczany'], keyFeature:true, typePart:true, compareMode:'equal', order:10, active:true }], ['Zawiasy']);
      const nalozenie = params.find((row)=> row && row.category === 'Zawiasy' && row.key === 'nalozenie');
      const options = nalozenie && nalozenie.options || [];
      const list = FC.hardwareCatalogSeeds && typeof FC.hardwareCatalogSeeds.mergeAccessorySeeds === 'function' ? FC.hardwareCatalogSeeds.mergeAccessorySeeds([]) : [];
      return types.some((row)=> row.id === 'hinge_parallel_inset' && row.name === 'Równoległy wpuszczany')
        && types.some((row)=> row.id === 'hinge_fridge_overlay' && row.name === 'Lodówkowy nakładany')
        && !types.some((row)=> /rogowej ślepej|ślepego narożnika/i.test(String(row.name || '')))
        && options.includes('równoległy wpuszczany')
        && options.includes('lodówkowy nakładany')
        && !options.includes('równoległy / do ślepego narożnika')
        && !options.includes('lodówkowy')
        && list.some((row)=> row && row.symbol === '79B9550+173L6130' && row.technicalParams && row.technicalParams.nalozenie && row.technicalParams.nalozenie.value === 'równoległy wpuszczany')
        && list.some((row)=> row && row.symbol === '91K9550+194K6100' && row.technicalParams && row.technicalParams.nalozenie && row.technicalParams.nalozenie.value === 'lodówkowy nakładany');
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
