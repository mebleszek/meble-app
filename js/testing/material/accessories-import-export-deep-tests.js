(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function assertMoney(value, expected, message){ H.assert(Math.abs(round2(value) - round2(expected)) < 0.001, message, { value, expected }); }
  function clone(value){ return JSON.parse(JSON.stringify(value == null ? null : value)); }
  function store(){ return FC.catalogStore; }
  function api(){ H.assert(FC.hardwareCatalogImportExport, 'Brak FC.hardwareCatalogImportExport'); return FC.hardwareCatalogImportExport; }
  function priceApi(){ H.assert(FC.hardwareSupplierPriceXlsx, 'Brak FC.hardwareSupplierPriceXlsx'); return FC.hardwareSupplierPriceXlsx; }
  function confirmApi(){ H.assert(FC.priceModalHardwarePriceConfirm, 'Brak FC.priceModalHardwarePriceConfirm'); return FC.priceModalHardwarePriceConfirm; }

  function snapshot(){
    const s = store();
    return {
      accessories:s && s.getAccessories ? s.getAccessories() : [],
      suppliers:s && s.getHardwareSuppliers ? s.getHardwareSuppliers() : [],
      settings:s && s.getHardwareSettings ? s.getHardwareSettings() : {},
      manufacturers:s && s.getHardwareManufacturers ? s.getHardwareManufacturers() : [],
      categories:s && s.getHardwareCategories ? s.getHardwareCategories() : [],
      types:s && s.getHardwareTypes ? s.getHardwareTypes() : [],
      technicalParams:s && s.getHardwareTechnicalParams ? s.getHardwareTechnicalParams() : [],
    };
  }
  function restore(snap){
    const s = store();
    if(!s || !snap) return;
    if(s.saveHardwareSuppliers) s.saveHardwareSuppliers(clone(snap.suppliers || []));
    if(s.saveHardwareSettings) s.saveHardwareSettings(clone(snap.settings || {}));
    if(s.saveHardwareCategories) s.saveHardwareCategories(clone(snap.categories || []));
    if(s.saveHardwareTypes) s.saveHardwareTypes(clone(snap.types || []));
    if(s.saveHardwareTechnicalParams) s.saveHardwareTechnicalParams(clone(snap.technicalParams || []));
    if(s.savePriceList) s.savePriceList('accessories', clone(snap.accessories || []));
    if(s.saveHardwareManufacturers) s.saveHardwareManufacturers(clone(snap.manufacturers || []));
  }
  function withSnapshot(fn){
    const snap = snapshot();
    try{ return fn(); }
    finally{ restore(snap); }
  }
  async function withSnapshotAsync(fn){
    const snap = snapshot();
    try{ return await fn(); }
    finally{ restore(snap); }
  }

  function suppliers(){
    return [
      { id:'mago', name:'MAGO', defaultDiscountPercent:10, active:true },
      { id:'bivert', name:'Bivert', defaultDiscountPercent:0, active:true },
      { id:'local', name:'Hurtownia lokalna', defaultDiscountPercent:5, active:true },
    ];
  }
  function baseAccessory(extra){
    return Object.assign({
      id:'deep_hw_1', manufacturer:'Blum', symbol:'D-1', name:'Zawias deep', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', hardwareType:'', series:'Deep', supplierId:'mago',
      supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, priceDate:'2026-05-10', priceStatus:'current', useForQuote:true }],
      quoteBase:'catalogGross', pricingMode:'markup', markupPercent:20,
    }, extra || {});
  }
  function setup(rows, cfg){
    const s = store();
    H.assert(s && s.savePriceList && s.saveHardwareSuppliers && s.saveHardwareSettings, 'Brak API catalogStore');
    s.saveHardwareSuppliers(clone((cfg && cfg.suppliers) || suppliers()));
    s.saveHardwareSettings(Object.assign({ defaultVatRate:23, defaultSupplierId:'mago', defaultMarkupPercent:20, defaultQuoteBase:'catalogGross', defaultPricingMode:'markup' }, (cfg && cfg.settings) || {}));
    s.saveHardwareManufacturers((cfg && cfg.manufacturers) || ['Blum','Peka','GTV']);
    s.saveHardwareCategories((cfg && cfg.categories) || ['Zawiasy','Szuflady / prowadnice','Cargo / organizery']);
    s.saveHardwareTypes((cfg && cfg.types) || [{ id:'type_110', name:'110° nakładany', allowedCategories:['Zawiasy'], active:true }]);
    if(s.saveHardwareTechnicalParams) s.saveHardwareTechnicalParams(clone((cfg && cfg.technicalParams) || (FC.hardwareTechnicalParams && FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS) || []));
    return s.savePriceList('accessories', clone(rows || [baseAccessory()]));
  }
  function stored(id){ return (store().getAccessories() || []).find((row)=> text(row && row.id) === text(id)); }
  function planned(plan, id){ return (plan.next.accessories || []).find((row)=> text(row && row.id) === text(id)); }
  function priceOf(row, supplierId){ return row && (row.supplierPrices || []).find((price)=> text(price && price.supplierId) === text(supplierId)); }
  function build(data, mode){ return api().buildImportPlan(data || {}, { mode:mode || 'merge' }); }
  function apply(plan){ return api().applyImportPlan(plan); }
  function priceRow(row){ return Object.assign({ __rowIndex:20, producent:'Blum', okucie_symbol:'D-1', dostawca:'MAGO', cena_netto:11, data_ceny:'2026-05-13' }, row || {}); }
  function buttonByText(rootNode, label){
    return Array.from(rootNode.querySelectorAll('button') || []).find((btn)=> text(btn.textContent) === label) || null;
  }
  function wait(ms){ return new Promise((resolve)=> setTimeout(resolve, ms)); }

  function collectTests(){
    return [
      H.makeTest('Akcesoria — głęboki import/export', 'Podgląd aktualizacji ceny nie mutuje store', 'Chroni błąd, w którym buildImportPlan zmieniał katalog jeszcze przed zatwierdzeniem.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const plan = build({ supplierPriceRows:[priceRow({ cena_netto:15 })] });
        H.assert(plan.summary.supplierPricesUpdated === 1, 'Plan nie widzi aktualizacji ceny', plan.summary);
        assertMoney(priceOf(stored('deep_hw_1'), 'mago').catalogPriceNet, 10, 'Store został zmieniony przez sam podgląd importu');
        assertMoney(priceOf(planned(plan, 'deep_hw_1'), 'mago').catalogPriceNet, 15, 'Plan nie ma nowej ceny w next');
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Podgląd dodania ceny nie mutuje store', 'Pilnuje, że nowa cena dostawcy pojawia się dopiero po applyImportPlan.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const plan = build({ supplierPriceRows:[priceRow({ dostawca:'Bivert', cena_netto:'', cena_brutto:24.6, data_ceny:'2026-05-13' })] });
        H.assert(plan.summary.supplierPricesAdded === 1, 'Plan nie widzi dodania nowej ceny', plan.summary);
        H.assert(!priceOf(stored('deep_hw_1'), 'bivert'), 'Store dostał cenę Bivert przed zatwierdzeniem', stored('deep_hw_1'));
        assertMoney(priceOf(planned(plan, 'deep_hw_1'), 'bivert').catalogPriceNet, 20, 'Plan nie policzył netto z brutto po globalnym VAT');
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'applyImportPlan zapisuje dopiero zaakceptowaną aktualizację', 'Sprawdza końcową ścieżkę: plan → zatwierdzenie → zapis ceny.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const plan = build({ supplierPriceRows:[priceRow({ cena_netto:18 })] });
        apply(plan);
        assertMoney(priceOf(stored('deep_hw_1'), 'mago').catalogPriceNet, 18, 'Po applyImportPlan cena MAGO nie została zaktualizowana');
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Wiersz __skipImport nie zapisuje ceny po applyImportPlan', 'Chroni Ignoruj / Ignoruj wszystkie przed cichą zmianą danych.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const plan = build({ supplierPriceRows:[priceRow({ cena_netto:22, __skipImport:true })] });
        H.assert(plan.summary.supplierPricesSkipped === 1, 'Plan nie policzył pominiętej ceny', plan.summary);
        apply(plan);
        assertMoney(priceOf(stored('deep_hw_1'), 'mago').catalogPriceNet, 10, 'Pominięty wiersz mimo wszystko zmienił cenę');
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Import bez zmian jest naprawdę bez zmian', 'Chroni podgląd przed fałszywymi aktualizacjami po eksporcie i imporcie tego samego pliku.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const plan = build({ supplierPriceRows:[priceRow({ cena_netto:10, cena_brutto:12.3, data_ceny:'2026-05-10', do_wyceny:'TAK', status_ceny:'current' })] });
        H.assert(plan.summary.supplierPricesUnchanged === 1, 'Identyczna cena nie została policzona jako bez zmian', plan.summary);
        H.assert((plan.summary.supplierPriceChanges || []).length === 0, 'Identyczna cena trafiła do potwierdzeń zmian', plan.summary);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Różna nazwa z cennika nie nadpisuje nazwy katalogowej', 'Cena z hurtowni może mieć inną nazwę, ale kluczem jest producent+symbol.', ()=> withSnapshot(()=>{
        setup([baseAccessory({ name:'Nazwa katalogowa deep' })]);
        const plan = build({ supplierPriceRows:[priceRow({ okucie_nazwa:'Nazwa z hurtowni inna', cena_netto:19 })] });
        H.assert(planned(plan, 'deep_hw_1').name === 'Nazwa katalogowa deep', 'Nazwa katalogowa została nadpisana nazwą z arkusza cen', planned(plan, 'deep_hw_1'));
        H.assert(plan.summary.supplierPricesUpdated === 1, 'Cena nie zaktualizowała się mimo zgodnego producent+symbol', plan.summary);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Brak albo śmieciowy dostawca dla istniejącego okucia trafia do resolvera', 'Pilnuje realnego błędu z Excela, gdzie dostawca był pusty albo wyszedł jako liczba.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const gaps = priceApi().supplierPriceMissingSupplierGaps([priceRow({ dostawca:'14', dostawca_id:'', cena_netto:30 })], store().getAccessories(), store().getHardwareSuppliers());
        H.assert(gaps.length === 1 && gaps[0].gaps.includes('supplierName'), 'Brak/śmieciowy dostawca nie trafił do resolvera', gaps);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Ten sam rekord z katalogu i arkusza Okucia nie blokuje resolvera dostawcy', 'Chroni regresję po refaktorze dopasowania producent+symbol.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const imported = [Object.assign({}, baseAccessory({ name:'Zawias deep z arkusza' }))];
        const combined = store().getAccessories().concat(imported);
        const gaps = priceApi().supplierPriceMissingSupplierGaps([priceRow({ dostawca:'14', cena_netto:30 })], combined, store().getHardwareSuppliers());
        H.assert(gaps.length === 1, 'Duplikat logiczny katalog+arkusz zablokował resolver brakującego dostawcy', gaps);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Nowe okucie z arkusza cen bez kategorii/jednostki wymaga resolvera', 'Program nie może automatycznie wpisywać Inne/szt. przy nowej pozycji.', ()=> withSnapshot(()=>{
        setup([]);
        const rows = [priceRow({ producent:'Peka', okucie_symbol:'NEW-1', okucie_nazwa:'Nowe z ceny', dostawca:'MAGO', cena_netto:30, kategoria:'', jednostka:'' })];
        const gaps = priceApi().supplierPriceCreateRequiredGaps(rows, store().getAccessories(), store().getHardwareSuppliers(), store().getHardwareManufacturers());
        H.assert(gaps.length === 1 && gaps[0].gaps.includes('itemCategory') && gaps[0].gaps.includes('itemUnit'), 'Brak kategorii/jednostki nie wymaga resolvera', gaps);
        const plan = build({ supplierPriceRows:rows });
        H.assert(plan.summary.supplierPriceCreatedAccessories === 0, 'Nowe okucie zostało utworzone mimo braku kategorii/jednostki', plan.summary);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Nowe okucie z pełnym wierszem cen tworzy pozycję i cenę', 'Pilnuje importu hurtowego bez ręcznego okucie_id i id_ceny.', ()=> withSnapshot(()=>{
        setup([]);
        const plan = build({ supplierPriceRows:[priceRow({ producent:'Peka', okucie_symbol:'NEW-2', okucie_nazwa:'Nowe pełne', kategoria:'Cargo / organizery', jednostka:'kpl.', dostawca:'MAGO', cena_netto:100 })] });
        H.assert(plan.summary.supplierPriceCreatedAccessories === 1 && plan.summary.supplierPricesAdded === 1, 'Plan nie utworzył nowego okucia i ceny', plan.summary);
        apply(plan);
        const row = (store().getAccessories() || []).find((item)=> item.symbol === 'NEW-2' && item.manufacturer === 'Peka');
        H.assert(row && row.name === 'Nowe pełne' && row.hardwareCategory === 'Cargo / organizery' && row.hardwareUnit === 'kpl.', 'Nowe okucie ma złe dane', row);
        assertMoney(priceOf(row, 'mago').catalogPriceNet, 100, 'Nowa cena MAGO nie zapisała się przy nowym okuciu');
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Literówka producenta nie tworzy producenta ani okucia', 'Producent musi być z istniejącej listy, żeby nie robić śmietnika.', ()=> withSnapshot(()=>{
        setup([]);
        const plan = build({ supplierPriceRows:[priceRow({ producent:'Bluum', okucie_symbol:'BAD-1', okucie_nazwa:'Literówka', kategoria:'Zawiasy', jednostka:'szt.', dostawca:'MAGO', cena_netto:20 })] });
        H.assert(plan.summary.supplierPriceCreatedAccessories === 0 && plan.summary.supplierPriceCreateSkipped >= 1, 'Literówka producenta utworzyła okucie', plan.summary);
        H.assert(!plan.next.manufacturers.includes('Bluum'), 'Literówka producenta trafiła do słownika producentów', plan.next.manufacturers);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Do wyceny przenosi ptaszek na nowego dostawcę dopiero po zatwierdzeniu', 'Chroni zasadę jednej ceny Do wyceny przy jednym okuciu.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const plan = build({ supplierPriceRows:[priceRow({ dostawca:'Bivert', cena_netto:13, do_wyceny:'TAK' })] });
        const plannedRow = planned(plan, 'deep_hw_1');
        H.assert(priceOf(plannedRow, 'bivert').useForQuote === true && priceOf(plannedRow, 'mago').useForQuote === false, 'Plan nie przeniósł Do wyceny na Bivert', plannedRow);
        H.assert(priceOf(stored('deep_hw_1'), 'mago').useForQuote === true && !priceOf(stored('deep_hw_1'), 'bivert'), 'Store zmienił Do wyceny przed apply', stored('deep_hw_1'));
        apply(plan);
        H.assert(priceOf(stored('deep_hw_1'), 'bivert').useForQuote === true && priceOf(stored('deep_hw_1'), 'mago').useForQuote === false, 'Po apply nie ma dokładnie jednej ceny Do wyceny', stored('deep_hw_1'));
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Globalny VAT z ustawień liczy brakujące netto/brutto przy imporcie', 'VAT ma być globalny, a nie z dostawcy.', ()=> withSnapshot(()=>{
        setup([baseAccessory()], { settings:{ defaultVatRate:24 }, suppliers:[{ id:'mago', name:'MAGO', defaultDiscountPercent:0, defaultVatRate:8, active:true }] });
        const plan = build({ settings:{ defaultVatRate:24 }, supplierPriceRows:[priceRow({ cena_netto:100 })] });
        assertMoney(priceOf(planned(plan, 'deep_hw_1'), 'mago').catalogPriceGross, 124, 'Brutto nie zostało policzone z globalnego VAT 24%');
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Rabat dostawcy jest zachowany po imporcie ceny', 'Po apply okucie ma koszt zakupu po rabacie, a nie tylko cenę katalogową.', ()=> withSnapshot(()=>{
        setup([baseAccessory()], { suppliers:[{ id:'mago', name:'MAGO', defaultDiscountPercent:10, active:true }] });
        const plan = build({ supplierPriceRows:[priceRow({ cena_netto:100, do_wyceny:'TAK' })] });
        apply(plan);
        const row = stored('deep_hw_1');
        assertMoney(row.catalogPriceGross, 123, 'Cena katalogowa brutto jest zła');
        assertMoney(row.purchasePriceGross, 110.7, 'Koszt zakupu po rabacie 10% jest zły');
      })),

      H.makeTest('Akcesoria — głęboki import/export', '#REF! nie jest ceną, ale poprawne drugie pole jest przeliczane', 'Chroni ręczne kopiowanie wierszy Excela z błędami formuł.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const parsed = priceApi().parseSupplierPriceRow(priceRow({ cena_netto:'#REF!', cena_brutto:24.6 }));
        H.assert(parsed.catalogPriceNet === 0 && parsed.catalogPriceGross === 24.6 && parsed.enteredPriceType === 'gross', 'Parser źle potraktował #REF! albo cenę brutto', parsed);
        const plan = build({ supplierPriceRows:[priceRow({ cena_netto:'#REF!', cena_brutto:24.6 })] });
        assertMoney(priceOf(planned(plan, 'deep_hw_1'), 'mago').catalogPriceNet, 20, 'Import nie policzył netto z poprawnej ceny brutto');
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Eksport dostawców i cen ma układ bez VAT i bez formuł pustych wierszy', 'Pilnuje Excela: dostawcy bez VAT, cena netto/brutto bez zapętleń.', ()=> withSnapshot(()=>{
        setup([baseAccessory()]);
        const importApi = api();
        const exporter = FC.hardwareCatalogExportXlsx;
        const supplierExport = FC.hardwareSupplierPriceXlsx;
        const supplierHeaders = importApi.SUPPLIER_COLUMNS.map((pair)=> pair[0]);
        H.assert(!supplierHeaders.includes('vat_domyslny_proc'), 'Arkusz Dostawcy nadal eksportuje VAT', supplierHeaders);
        const rows = supplierExport.buildSupplierPriceRows(store().getAccessories(), store().getHardwareSuppliers(), store().getHardwareSettings());
        const headers = rows[0];
        H.assert(headers.slice(0, 6).join('|') === 'okucie_nazwa|okucie_symbol|producent|kategoria|jednostka|dostawca', 'Ceny_dostawcow nie zaczyna się od danych użytkowych', headers);
        const empty = rows[rows.length - 1];
        H.assert(!empty.some((cell)=> cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'formula')), 'Pusty wiersz Ceny_dostawcow ma formułę', empty);
        const payload = exporter.makeExportPayload();
        H.assert(payload && payload.data && Array.isArray(payload.data.suppliers) && !Object.prototype.hasOwnProperty.call(payload.data.suppliers[0] || {}, 'defaultVatRate'), 'Snapshot eksportu nadal trzyma VAT u dostawcy', payload.data.suppliers);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Eksport tworzy arkusze grupowe z kolumnami parametrów kategorii', 'Chroni Excela przed jednym puchnącym arkuszem do wszystkich typów okuć.', ()=> withSnapshot(()=>{
        const s = store();
        const exporter = FC.hardwareCatalogExportXlsx;
        H.assert(exporter && exporter._debug && exporter._debug.buildGroupedAccessorySheets, 'Brak eksportu arkuszy grupowych');
        setup([baseAccessory({
          id:'xlsx_hinge_1', manufacturer:'Blum', symbol:'HX-1', name:'Zawias grupowy', hardwareCategory:'Zawiasy', hardwareUnit:'szt.',
          technicalParams:{ nalozenie:{ value:'nakładany' }, kat_otwarcia:{ from:110 }, hamulec:{ value:true } }
        })], {
          technicalParams:[
            { category:'Zawiasy', key:'nalozenie', label:'Nałożenie', fieldType:'choice', options:['nakładany'], compareMode:'equal', keyFeature:true, typePart:true, active:true },
            { category:'Zawiasy', key:'kat_otwarcia', label:'Kąt otwarcia', fieldType:'numberRange', unit:'°', compareMode:'withinRange', keyFeature:true, typePart:true, active:true },
            { category:'Zawiasy', key:'hamulec', label:'Hamulec', fieldType:'boolean', compareMode:'equal', keyFeature:true, typePart:true, active:true },
          ]
        });
        const snap = { accessories:s.getAccessories(), categories:s.getHardwareCategories(), technicalParams:s.getHardwareTechnicalParams() };
        const sheets = exporter._debug.buildGroupedAccessorySheets(snap);
        const sheet = sheets.Okucia_zawiasy || sheets.Okucia_Zawiasy;
        H.assert(sheet && Array.isArray(sheet.rows), 'Brak arkusza Okucia_zawiasy', Object.keys(sheets));
        const headers = sheet.rows[0];
        H.assert(headers.includes('nalozenie') && headers.includes('kat_otwarcia_od') && headers.includes('kat_otwarcia_do') && headers.includes('hamulec'), 'Arkusz kategorii nie ma dynamicznych kolumn', headers);
        const row = sheet.rows[1];
        H.assert(row[headers.indexOf('nalozenie')] === 'nakładany' && Number(row[headers.indexOf('kat_otwarcia_od')]) === 110, 'Wiersz grupowy nie eksportuje wartości parametrów', { headers, row });
      })),
      H.makeTest('Akcesoria — głęboki import/export', 'Import arkusza grupowego odtwarza parametry i typ automatyczny', 'Chroni dodawanie nowych artykułów przez arkusze grupowe zamiast ręcznego klikania w programie.', ()=> withSnapshot(()=>{
        const parser = FC.hardwareCatalogImportParser;
        H.assert(parser && typeof parser.parseWorkbook === 'function', 'Brak parsera XLSX');
        const workbook = {
          Parametry_techniczne:[
            ['kategoria','klucz','nazwa','typ_pola','jednostka','wartosci','cecha_kluczowa','buduje_typ','sposob_porownania','aktywna','kolejnosc','opis'],
            ['Zawiasy','nalozenie','Nałożenie','choice','','nakładany; wpuszczany','TAK','TAK','equal','TAK','1',''],
            ['Zawiasy','kat_otwarcia','Kąt otwarcia','numberRange','°','','TAK','TAK','withinRange','TAK','2','']
          ],
          Okucia_zawiasy:[
            ['id','producent','system_okucia','symbol','nazwa','kategoria','jednostka','typ_cecha','nalozenie','kat_otwarcia_od','kat_otwarcia_do'],
            ['grp_hinge_1','Blum','Blum CLIP top','HX-G1','Zawias grupowy','Zawiasy','szt.','','nakładany',90,110]
          ],
          Ceny_dostawcow:[['okucie_nazwa','okucie_symbol','producent','kategoria','jednostka','dostawca','cena_netto','cena_brutto','do_wyceny','status_ceny','data_ceny','okucie_id','dostawca_id']]
        };
        const parsed = parser.parseWorkbook(workbook);
        H.assert(parsed.technicalParams.length >= 2, 'Import nie odczytał definicji parametrów', parsed);
        H.assert(parsed.accessories.length === 1, 'Import arkusza grupowego nie odczytał jednej pozycji', parsed.accessories);
        const plan = build(parsed);
        const row = (plan.next.accessories || []).find((item)=> item.id === 'grp_hinge_1');
        H.assert(row && row.technicalParams && row.technicalParams.nalozenie && row.technicalParams.kat_otwarcia, 'Parametry techniczne nie przeszły do planu', row);
        H.assert(String(row.hardwareType || '').includes('nakładany') && String(row.hardwareType || '').includes('90') && String(row.hardwareType || '').includes('110°'), 'Typ nie został zbudowany z zakresu i cech', row);
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Potwierdzenie Zostaw starą zwraca plan bez aktualizacji', 'Sprawdza UI-confirm bez klikania ręcznego: pominięcie ma oznaczać brak zapisu.', ()=> withSnapshotAsync(async ()=>{
        setup([baseAccessory()]);
        const data = { supplierPriceRows:[priceRow({ cena_netto:33 })] };
        const plan = build(data);
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        const promise = confirmApi().confirmSupplierPriceChanges(plan, data, { api:api(), mount, mode:'merge' });
        const skip = buttonByText(mount, 'Zostaw starą');
        H.assert(skip, 'Nie znaleziono przycisku Zostaw starą w potwierdzeniu', mount.textContent);
        skip.click();
        const finalPlan = await promise;
        await wait(10);
        H.assert(finalPlan && finalPlan.summary.supplierPricesUpdated === 0 && finalPlan.summary.supplierPricesSkipped === 1, 'Zostaw starą nie zwróciło planu bez aktualizacji', finalPlan && finalPlan.summary);
        apply(finalPlan);
        assertMoney(priceOf(stored('deep_hw_1'), 'mago').catalogPriceNet, 10, 'Po Zostaw starą cena została zmieniona');
        mount.remove();
      })),

      H.makeTest('Akcesoria — głęboki import/export', 'Potwierdzenie Zaktualizuj zostawia aktualizację w planie', 'Sprawdza UI-confirm: zaakceptowana zmiana ma zostać zapisana dopiero po apply.', ()=> withSnapshotAsync(async ()=>{
        setup([baseAccessory()]);
        const data = { supplierPriceRows:[priceRow({ cena_netto:44 })] };
        const plan = build(data);
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        const promise = confirmApi().confirmSupplierPriceChanges(plan, data, { api:api(), mount, mode:'merge' });
        const confirm = buttonByText(mount, 'Zaktualizuj');
        H.assert(confirm, 'Nie znaleziono przycisku Zaktualizuj w potwierdzeniu', mount.textContent);
        confirm.click();
        const finalPlan = await promise;
        await wait(10);
        H.assert(finalPlan && finalPlan.summary.supplierPricesUpdated === 1, 'Zaktualizuj nie zostawiło aktualizacji w planie', finalPlan && finalPlan.summary);
        assertMoney(priceOf(stored('deep_hw_1'), 'mago').catalogPriceNet, 10, 'Samo potwierdzenie zmieniło store przed apply');
        apply(finalPlan);
        assertMoney(priceOf(stored('deep_hw_1'), 'mago').catalogPriceNet, 44, 'Po apply zaakceptowana cena nie została zapisana');
        mount.remove();
      })),
    ];
  }

  FC.materialImportExportDeepTests = { collectTests };
})(typeof window !== 'undefined' ? window : globalThis);
