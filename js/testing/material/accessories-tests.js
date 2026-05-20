(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function assertMoney(value, expected, message){ H.assert(Math.abs(round2(value) - round2(expected)) < 0.001, message, { value, expected }); }

  function store(){ return FC.catalogStore; }
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
    if(s.saveHardwareSuppliers) s.saveHardwareSuppliers(snap.suppliers || []);
    if(s.saveHardwareSettings) s.saveHardwareSettings(snap.settings || {});
    if(s.saveHardwareCategories) s.saveHardwareCategories(snap.categories || []);
    if(s.saveHardwareTypes) s.saveHardwareTypes(snap.types || []);
    if(s.saveHardwareTechnicalParams) s.saveHardwareTechnicalParams(snap.technicalParams || []);
    if(s.savePriceList) s.savePriceList('accessories', snap.accessories || []);
    if(s.saveHardwareManufacturers) s.saveHardwareManufacturers(snap.manufacturers || []);
  }
  function withSnapshot(fn){
    const snap = snapshot();
    try{ return fn(); }
    finally{ restore(snap); }
  }
  function requireHardware(){
    H.assert(FC.hardwareCatalog, 'Brak FC.hardwareCatalog');
    return FC.hardwareCatalog;
  }
  function requireImport(){
    H.assert(FC.hardwareCatalogImportExport, 'Brak FC.hardwareCatalogImportExport');
    return FC.hardwareCatalogImportExport;
  }
  function requireSupplierXlsx(){
    H.assert(FC.hardwareSupplierPriceXlsx, 'Brak FC.hardwareSupplierPriceXlsx');
    return FC.hardwareSupplierPriceXlsx;
  }
  function suppliers(){
    return [
      { id:'mago', name:'MAGO', defaultDiscountPercent:10, active:true },
      { id:'bivert', name:'Bivert', defaultDiscountPercent:0, active:true },
      { id:'local', name:'Hurtownia lokalna', defaultDiscountPercent:5, active:true },
    ];
  }

  function collectTests(){
    return [
      H.makeTest('Akcesoria — model ceny', 'Jednostka para normalizuje się do kpl., ale kpl. nie jest zestawem', 'Pilnuje decyzji, że para nie wraca jako osobna jednostka, a zestaw jest tylko dla składanych kompletów.', ()=>{
        const hw = requireHardware();
        H.assert(hw.normalizeUnit('para') === 'kpl.', 'Para nie została znormalizowana do kpl.');
        H.assert(hw.normalizeUnit('kpl.') === 'kpl.', 'kpl. nie zostało zachowane jako zwykła jednostka');
        H.assert(hw.isBundleUnit('zestaw') === true, 'zestaw nie jest rozpoznany jako składany zestaw');
        H.assert(hw.isBundleUnit('kpl.') === false, 'kpl. błędnie działa jak zestaw składany');
        H.assert(Array.isArray(hw.UNITS) && !hw.UNITS.includes('para'), 'Lista jednostek nadal zawiera para', hw.UNITS);
      }),
      H.makeTest('Akcesoria — model ceny', 'VAT dostawcy jest ignorowany, a netto/brutto liczy globalny VAT', 'Chroni decyzję: VAT jest globalny w ustawieniach, rabat zostaje przy dostawcy.', ()=>{
        const hw = requireHardware();
        const row = hw.normalizeAccessory({
          id:'vat_global_1', name:'Global VAT test', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', supplierId:'mago',
          supplierPrices:[{ supplierId:'mago', catalogPriceNet:100, useForQuote:true }],
        }, ()=> 'vat_global_1', { defaultVatRate:23, hardwareSuppliers:[{ id:'mago', name:'MAGO', defaultVatRate:8, defaultDiscountPercent:0, active:true }] });
        assertMoney(row.catalogPriceGross, 123, 'Cena brutto nie została policzona z globalnego VAT 23%');
        H.assert(row.vatRate === 23, 'Okucie nie trzyma globalnego VAT 23%', row);
      }),
      H.makeTest('Akcesoria — model ceny', 'Rabat dostawcy obniża koszt zakupu, ale nie cenę katalogową', 'Pilnuje rozdzielenia ceny katalogowej od ceny zakupu po rabacie.', ()=>{
        const hw = requireHardware();
        const row = hw.normalizeAccessory({
          id:'discount_1', name:'Rabat test', manufacturer:'Blum', hardwareCategory:'Zawiasy', supplierId:'mago',
          supplierPrices:[{ supplierId:'mago', catalogPriceGross:123, useForQuote:true }], quoteBase:'catalogGross', pricingMode:'markup', markupPercent:20,
        }, ()=> 'discount_1', { defaultVatRate:23, hardwareSuppliers:[{ id:'mago', name:'MAGO', defaultDiscountPercent:10, active:true }] });
        assertMoney(row.catalogPriceGross, 123, 'Cena katalogowa brutto została naruszona przez rabat');
        assertMoney(row.purchasePriceGross, 110.7, 'Cena zakupu brutto nie uwzględnia rabatu 10%');
        assertMoney(row.price, 147.6, 'Cena do wyceny nie została policzona z katalogowej brutto + narzut');
      }),
      H.makeTest('Akcesoria — model ceny', 'Cena do wyceny może bazować na zakupie po rabacie', 'Chroni tryb purchaseGross, żeby narzut mógł iść od realnego kosztu zakupu.', ()=>{
        const hw = requireHardware();
        const row = hw.normalizeAccessory({
          id:'purchase_base_1', name:'Zakup bazą', manufacturer:'Blum', hardwareCategory:'Zawiasy', supplierId:'mago',
          supplierPrices:[{ supplierId:'mago', catalogPriceGross:123, useForQuote:true }], quoteBase:'purchaseGross', pricingMode:'markup', markupPercent:20,
        }, ()=> 'purchase_base_1', { defaultVatRate:23, hardwareSuppliers:[{ id:'mago', name:'MAGO', defaultDiscountPercent:10, active:true }] });
        assertMoney(row.purchasePriceGross, 110.7, 'Koszt zakupu po rabacie jest zły');
        assertMoney(row.price, 132.84, 'Cena do wyceny nie bazuje na zakupie po rabacie');
      }),
      H.makeTest('Akcesoria — model ceny', 'Cena ręczna klienta nie jest nadpisywana narzutem', 'Pilnuje trybu manualPrice dla wyjątkowych okuć.', ()=>{
        const hw = requireHardware();
        const row = hw.normalizeAccessory({
          id:'manual_price_1', name:'Cena ręczna', manufacturer:'Blum', hardwareCategory:'Zawiasy', supplierId:'mago',
          supplierPrices:[{ supplierId:'mago', catalogPriceGross:123, useForQuote:true }], pricingMode:'manualPrice', quotePriceGross:199,
        }, ()=> 'manual_price_1', { defaultVatRate:23, hardwareSuppliers:suppliers() });
        assertMoney(row.price, 199, 'Cena ręczna została nadpisana');
        assertMoney(row.quotePriceGross, 199, 'quotePriceGross nie jest zgodne z ceną ręczną');
      }),
      H.makeTest('Akcesoria — model ceny', 'Tylko jedna cena dostawcy może być Do wyceny', 'Pilnuje ptaszka Do wyceny przy wielu dostawcach jednego okucia.', ()=>{
        const hw = requireHardware();
        const prices = hw.normalizeSupplierPrices([
          { supplierId:'mago', catalogPriceNet:10, useForQuote:true },
          { supplierId:'bivert', catalogPriceNet:11, useForQuote:true },
        ], {}, suppliers(), { defaultVatRate:23 });
        H.assert(prices.filter((row)=> row.useForQuote).length === 1, 'Więcej niż jedna cena ma Do wyceny', prices);
        H.assert(prices.find((row)=> row.supplierId === 'bivert' && row.useForQuote), 'Ostatni zaznaczony dostawca nie przejął Do wyceny', prices);
      }),
      H.makeTest('Akcesoria — model ceny', 'Jedyna cena dostawcy automatycznie staje się Do wyceny', 'Chroni prosty przypadek jednego dostawcy bez ręcznego ptaszka.', ()=>{
        const hw = requireHardware();
        const prices = hw.normalizeSupplierPrices([{ supplierId:'mago', catalogPriceGross:12.3 }], {}, suppliers(), { defaultVatRate:23 });
        H.assert(prices.length === 1 && prices[0].useForQuote === true, 'Jedyna cena nie została ustawiona jako Do wyceny', prices);
      }),
      H.makeTest('Akcesoria — model ceny', 'Błędy arkusza #REF! nie tworzą ceny dostawcy', 'Chroni import z telefonu/Excela przed przyjęciem błędów formuł jako ceny.', ()=>{
        const hw = requireHardware();
        const row = hw.normalizeAccessory({
          id:'ref_1', name:'REF test', manufacturer:'Blum', hardwareCategory:'Zawiasy', supplierPrices:[{ supplierId:'mago', catalogPriceNet:'#REF!', catalogPriceGross:'#VALUE!', useForQuote:true }],
        }, ()=> 'ref_1', { defaultVatRate:23, hardwareSuppliers:suppliers() });
        H.assert(Array.isArray(row.supplierPrices) && row.supplierPrices.length === 0, 'Błędy arkusza utworzyły cenę dostawcy', row.supplierPrices);
        H.assert(Number(row.catalogPriceGross) === 0 && Number(row.price) === 0, 'Błędna cena z arkusza przeszła do wartości okucia', row);
      }),
      H.makeTest('Akcesoria — model ceny', 'Status ceny rozpoznaje polskie i techniczne wartości', 'Chroni mapowanie current/review/old/archived po imporcie XLSX.', ()=>{
        const hw = requireHardware();
        H.assert(hw.normalizePriceStatus('Aktualna') === 'current', 'Aktualna nie mapuje się na current');
        H.assert(hw.normalizePriceStatus('Do sprawdzenia') === 'review', 'Do sprawdzenia nie mapuje się na review');
        H.assert(hw.normalizePriceStatus('Stara') === 'old', 'Stara nie mapuje się na old');
        H.assert(hw.normalizePriceStatus('Archiwalna') === 'archived', 'Archiwalna nie mapuje się na archived');
        H.assert(hw.normalizePriceStatus('dziwne') === 'current', 'Nieznany status nie wraca do current');
      }),

      H.makeTest('Akcesoria — dane techniczne', 'Okucie normalizuje system i parametry szuflady', 'Pilnuje nowych danych pod listy zakupowe bez dokładania klików przy szafce.', ()=>{
        const hw = requireHardware();
        const row = hw.normalizeAccessory({
          id:'tech_1', name:'Tandembox M 500', manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', hardwareUnit:'kpl.',
          system_okucia:'Blum TANDEMBOX', typ_cecha:'M 500 50kg', profil_szuflady:'M', dlugosc_mm:'500', nosnosc_kg:'50', wzmocniona:'TAK', kolor_okucia:'biały', zastosowanie:'frontowa'
        }, ()=> 'tech_1', { defaultVatRate:23, hardwareSuppliers:suppliers() });
        H.assert(row.hardwareSystem === 'Blum TANDEMBOX', 'System okucia nie został zapisany', row);
        H.assert(String(row.hardwareType || '').includes('M') && String(row.hardwareType || '').includes('500') && String(row.hardwareType || '').includes('50'), 'Typ/cecha nie został zbudowany z parametrów', row);
        H.assert(row.drawerProfile === 'M' && Number(row.drawerLengthMm) === 500 && Number(row.drawerLoadKg) === 50 && row.drawerReinforced === true, 'Parametry szuflady nie przeszły normalizacji', row);
        H.assert(row.hardwareColor === 'biały' && row.hardwareUsage === 'frontowa', 'Kolor/zastosowanie okucia nie zostały zapisane', row);
      }),
      H.makeTest('Akcesoria — dane techniczne', 'Unikalność typu uwzględnia system okucia', 'Chroni sytuację Blum TANDEMBOX M 500 i Blum LEGRABOX M 500 jako różne pozycje katalogowe.', ()=>{
        const hw = requireHardware();
        const rows = [
          { id:'tb', manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', hardwareSystem:'Blum TANDEMBOX', hardwareType:'M 500', name:'Tandembox M 500' },
          { id:'lg', manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', hardwareSystem:'Blum LEGRABOX', hardwareType:'M 500', name:'Legrabox M 500' },
        ];
        H.assert(hw.uniqueTypeConflict(rows, { manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', hardwareSystem:'Blum TANDEMBOX', hardwareType:'M 500' }, 'new').id === 'tb', 'Nie wykryto konfliktu w tym samym systemie');
        H.assert(!hw.uniqueTypeConflict(rows, { manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', hardwareSystem:'Blum MERIVOBOX', hardwareType:'M 500' }, 'new'), 'Inny system został potraktowany jak konflikt');
      }),

      H.makeTest('Akcesoria — dynamiczne dane techniczne', 'Parametry kategorii budują Typ / cechę automatycznie', 'Pilnuje przebudowy słownika: typ/cecha jest opisem z cech technicznych, nie ręcznym polem głównym.', ()=> withSnapshot(()=>{
        const s = store(), hw = requireHardware();
        H.assert(FC.hardwareTechnicalParams && typeof FC.hardwareTechnicalParams.buildTypeLabel === 'function', 'Brak modułu parametrów technicznych');
        s.saveHardwareCategories(['Zawiasy']);
        s.saveHardwareTechnicalParams([
          { category:'Zawiasy', key:'nalozenie', label:'Nałożenie', fieldType:'choice', options:['nakładany'], compareMode:'equal', keyFeature:true, typePart:true, active:true },
          { category:'Zawiasy', key:'kat_otwarcia', label:'Kąt otwarcia', fieldType:'numberRange', unit:'°', compareMode:'withinRange', keyFeature:true, typePart:true, active:true },
          { category:'Zawiasy', key:'hamulec', label:'Hamulec', fieldType:'boolean', compareMode:'equal', keyFeature:true, typePart:true, active:true },
        ]);
        const definitions = s.getHardwareTechnicalParams();
        const row = hw.normalizeAccessory({
          id:'hinge_dyn_1', manufacturer:'Blum', name:'Zawias dyn', hardwareCategory:'Zawiasy', hardwareUnit:'szt.',
          technicalParams:{ nalozenie:{ value:'nakładany' }, kat_otwarcia:{ from:110 }, hamulec:{ value:true } }
        }, ()=> 'hinge_dyn_1', { defaultVatRate:23, hardwareSuppliers:suppliers(), hardwareTechnicalParams:definitions });
        H.assert(String(row.hardwareType || '').includes('nakładany'), 'Typ nie zawiera nałożenia', row);
        H.assert(String(row.hardwareType || '').includes('110°'), 'Typ nie zawiera kąta z jednostką', row);
        H.assert(String(row.hardwareType || '').toLowerCase().includes('hamulec'), 'Typ nie zawiera cechy boolean', row);
        H.assert(row.hardwareTypeAuto === true, 'Typ nie został oznaczony jako automatyczny', row);
      })),
      H.makeTest('Akcesoria — dynamiczne dane techniczne', 'Wartość dokładna i zakres mają różne reguły porównania', 'Chroni zamianę okuć: długość może wymagać dokładnej wartości, a kąt zawiasu może mieścić się w zakresie.', ()=>{
        const api = FC.hardwareTechnicalParams;
        H.assert(api && typeof api.compareParam === 'function', 'Brak compareParam');
        H.assert(api.compareParam({ fieldType:'numberRange', compareMode:'equal' }, { from:350 }, { from:350 }) === true, 'Długość 350 nie pasuje do 350');
        H.assert(api.compareParam({ fieldType:'numberRange', compareMode:'equal' }, { from:350 }, { from:400 }) === false, 'Długość 350 błędnie pasuje do 400');
        H.assert(api.compareParam({ fieldType:'numberRange', compareMode:'withinRange' }, { from:110 }, { from:90, to:110 }) === true, '110° nie mieści się w zakresie 90-110');
        H.assert(api.compareParam({ fieldType:'numberRange', compareMode:'minGte' }, { from:30 }, { from:50 }) === true, '50 kg nie zastąpiło 30 kg');
        H.assert(api.compareParam({ fieldType:'numberRange', compareMode:'minGte' }, { from:50 }, { from:30 }) === false, '30 kg błędnie zastąpiło 50 kg');
      }),
      H.makeTest('Akcesoria — dynamiczne dane techniczne', 'Słownik parametrów technicznych zapisuje własne pola kategorii', 'Chroni edytowalne akordeony kategorii bez pomocy programisty.', ()=> withSnapshot(()=>{
        const s = store();
        H.assert(s && s.saveHardwareTechnicalParams && s.getHardwareTechnicalParams, 'Brak API słownika parametrów');
        s.saveHardwareCategories(['Testowa kategoria']);
        s.saveHardwareTechnicalParams([{ category:'Testowa kategoria', key:'szerokosc_modulu_mm', label:'Szerokość modułu', fieldType:'numberRange', unit:'mm', compareMode:'equal', keyFeature:true, typePart:true, active:true }]);
        const rows = s.getHardwareTechnicalParams().filter((row)=> row.category === 'Testowa kategoria');
        H.assert(rows.length === 1 && rows[0].key === 'szerokosc_modulu_mm', 'Własny parametr kategorii nie został zapisany', rows);
        H.assert(rows[0].keyFeature === true && rows[0].typePart === true, 'Ptaszki cechy kluczowej / typu nie zostały zapisane', rows[0]);
      })),

      H.makeTest('Akcesoria — dynamiczne dane techniczne', 'Parametry techniczne nie zapisują [object Object]', 'Chroni backup i przyszłą zamianę okuć: launchery/obiekty wyboru nie mogą trafiać do storage jako tekst [object Object].', ()=>{
        const hw = requireHardware();
        const row = hw.normalizeAccessory({
          id:'obj_object_guard_1', manufacturer:'Blum', name:'Zawias z obiektami', hardwareCategory:'Zawiasy', hardwareUnit:'szt.',
          hardwareType:{ value:{ label:'nie powinno wejść' } },
          technicalParams:{
            nalozenie:{ value:{ value:'nakładany', label:'Nakładany' } },
            kat_otwarcia:{ from:{ value:'90' }, to:{ label:'110' } },
            hamulec:{ value:{ value:true, label:'TAK' } },
            prowadnik:{ value:{ label:'standardowy' } }
          }
        }, ()=> 'obj_object_guard_1', { defaultVatRate:23, hardwareSuppliers:suppliers() });
        const raw = JSON.stringify(row);
        H.assert(raw.indexOf('[object Object]') === -1, 'Znormalizowane okucie nadal zawiera [object Object]', row);
        H.assert(row.technicalParams.nalozenie.value === 'nakładany', 'Nałożenie nie zostało wyciągnięte z obiektu wyboru', row.technicalParams);
        H.assert(Number(row.technicalParams.kat_otwarcia.from) === 90 && Number(row.technicalParams.kat_otwarcia.to) === 110, 'Zakres kąta nie został wyciągnięty z obiektów wyboru', row.technicalParams);
        H.assert(String(row.hardwareType || '').includes('nakładany') && String(row.hardwareType || '').includes('90') && String(row.hardwareType || '').includes('110°'), 'Automatyczny typ nie powstał z czystych wartości', row.hardwareType);
      }),

      H.makeTest('Akcesoria — słowniki', 'Kategorie łączą domyślne i własne bez duplikatów', 'Pilnuje, żeby słownik kategorii był edytowalny, ale bez śmieci po wielkości liter.', ()=>{
        const hw = requireHardware();
        const list = hw.normalizeCategoryList(['Zawiasy', 'Nowa kategoria', 'nowa kategoria']);
        H.assert(list.includes('Zawiasy') && list.includes('Nowa kategoria'), 'Brakuje kategorii domyślnej albo własnej', list);
        H.assert(list.filter((row)=> text(row).toLowerCase() === 'nowa kategoria').length === 1, 'Duplikat kategorii nie został usunięty', list);
      }),
      H.makeTest('Akcesoria — słowniki', 'Typy/cechy pamiętają dozwolone kategorie', 'Chroni słownik typów przed zgubieniem przypisania do kategorii.', ()=>{
        const hw = requireHardware();
        const list = hw.normalizeTypeList([{ id:'custom_runner', name:'Prowadnica testowa', allowedCategories:['Szuflady / prowadnice'], active:true }]);
        const row = list.find((item)=> item.id === 'custom_runner');
        H.assert(row && row.allowedCategories.includes('Szuflady / prowadnice'), 'Typ/cecha zgubił dozwoloną kategorię', row);
      }),
      H.makeTest('Akcesoria — słowniki', 'Typ / cecha filtruje się po kategorii', 'Pilnuje, żeby typy zawiasów nie pojawiały się przy prowadnicach i odwrotnie.', ()=>{
        const hw = requireHardware();
        const list = [{ id:'t1', name:'Tylko zawias', allowedCategories:['Zawiasy'], active:true }, { id:'t2', name:'Tylko cargo', allowedCategories:['Cargo / organizery'], active:true }];
        const hingeOptions = hw.typeOptions(list, 'Zawiasy', '');
        H.assert(hingeOptions.some((opt)=> opt.value === 'Tylko zawias'), 'Brak typu zawiasu w kategorii Zawiasy', hingeOptions);
        H.assert(!hingeOptions.some((opt)=> opt.value === 'Tylko cargo'), 'Typ cargo pojawił się przy zawiasach', hingeOptions);
      }),
      H.makeTest('Akcesoria — słowniki', 'Aktualnie wybrany typ zostaje widoczny nawet po zmianie kategorii', 'Chroni edycję starych danych: pole ma pokazać zapisaną wartość, nawet jeśli słownik już ją ogranicza.', ()=>{
        const hw = requireHardware();
        const opts = hw.typeOptions([{ id:'t1', name:'Stary typ', allowedCategories:['Zawiasy'], active:true }], 'Cargo / organizery', 'Stary typ');
        H.assert(opts.some((opt)=> opt.value === 'Stary typ'), 'Wybrany stary typ zniknął z listy opcji', opts);
      }),
      H.makeTest('Akcesoria — słowniki', 'Duplikat producent+kategoria+typ jest wykrywany, ale własny rekord nie blokuje siebie', 'Chroni blokadę duplikatów typów przed zapisem i przed fałszywym blokowaniem edycji.', ()=>{
        const hw = requireHardware();
        const rows = [
          { id:'a', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareType:'110° nakładany', name:'A' },
          { id:'b', manufacturer:'GTV', hardwareCategory:'Zawiasy', hardwareType:'110° nakładany', name:'B' },
        ];
        const conflict = hw.uniqueTypeConflict(rows, { manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareType:'110° nakładany' }, 'new');
        const self = hw.uniqueTypeConflict(rows, { manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareType:'110° nakładany' }, 'a');
        const otherProducer = hw.uniqueTypeConflict(rows, { manufacturer:'GTV', hardwareCategory:'Zawiasy', hardwareType:'110° nakładany' }, 'new');
        H.assert(conflict && conflict.id === 'a', 'Nie wykryto duplikatu u tego samego producenta', conflict);
        H.assert(self == null, 'Rekord blokuje sam siebie', self);
        H.assert(otherProducer && otherProducer.id === 'b', 'Ten sam typ u innego producenta powinien sprawdzać się osobno', otherProducer);
      }),
      H.makeTest('Akcesoria — słowniki', 'Pusty typ/cecha nie blokuje zapisu jako duplikat', 'Pilnuje, żeby stare okucia bez typu nie były fałszywie blokowane.', ()=>{
        const hw = requireHardware();
        const conflict = hw.uniqueTypeConflict([{ id:'a', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareType:'' }], { manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareType:'' }, 'b');
        H.assert(conflict == null, 'Pusty typ został potraktowany jako duplikat', conflict);
      }),
      H.makeTest('Akcesoria — słowniki', 'Store słownika typów zwraca kopie, nie referencje do cache', 'Chroni dane słowników przed przypadkową mutacją przez UI.', ()=> withSnapshot(()=>{
        const s = store();
        H.assert(s && s.saveHardwareTypes && s.getHardwareTypes, 'Brak API typów okuć');
        s.saveHardwareTypes([{ id:'copy_type', name:'Typ kopia', allowedCategories:['Zawiasy'], active:true }]);
        const a = s.getHardwareTypes();
        a[0].allowedCategories.push('ZEPSUTE');
        const b = s.getHardwareTypes();
        H.assert(!b[0].allowedCategories.includes('ZEPSUTE'), 'getHardwareTypes zwróciło referencję do cache', b[0]);
      })),

      H.makeTest('Akcesoria — store', 'Dostawca przechowuje rabat i aktywność, ale nie przechowuje VAT', 'Chroni decyzję: VAT globalny, rabat per dostawca.', ()=> withSnapshot(()=>{
        const s = store();
        H.assert(s && s.saveHardwareSuppliers && s.getHardwareSuppliers, 'Brak API dostawców');
        s.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:17, defaultVatRate:8, active:false }]);
        const row = s.getHardwareSuppliers().find((item)=> item.id === 'mago');
        H.assert(row && row.defaultDiscountPercent === 17 && row.active === false, 'Dostawca zgubił rabat albo aktywność', row);
        H.assert(!Object.prototype.hasOwnProperty.call(row, 'defaultVatRate'), 'Dostawca nadal przechowuje VAT', row);
      })),
      H.makeTest('Akcesoria — store', 'Ustawienia okuć przechowują globalny VAT', 'Chroni możliwość zmiany VAT-u w ustawieniach programu.', ()=> withSnapshot(()=>{
        const s = store();
        H.assert(s && s.saveHardwareSettings && s.getHardwareSettings, 'Brak API ustawień okuć');
        s.saveHardwareSettings({ defaultSupplierId:'mago', defaultVatRate:24, defaultMarkupPercent:22, defaultQuoteBase:'purchaseGross', defaultPricingMode:'markup' });
        const cfg = s.getHardwareSettings();
        H.assert(cfg.defaultVatRate === 24 && cfg.defaultSupplierId === 'mago' && cfg.defaultQuoteBase === 'purchaseGross', 'Ustawienia okuć nie zachowały globalnego VAT-u', cfg);
      })),
      H.makeTest('Akcesoria — store', 'Zapis akcesorium z cenami dostawców odtwarza źródło ceny z dostawcy Do wyceny', 'Pilnuje, żeby lista okuć pokazywała właściwego dostawcę aktywnej ceny.', ()=> withSnapshot(()=>{
        const s = store();
        H.assert(s && s.savePriceList && s.saveHardwareSuppliers, 'Brak API store');
        s.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, active:true }, { id:'local', name:'Hurtownia lokalna', defaultDiscountPercent:0, active:true }]);
        const saved = s.savePriceList('accessories', [{ id:'store_price_1', manufacturer:'Blum', symbol:'SP-1', name:'Store price', hardwareCategory:'Zawiasy', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10 }, { supplierId:'local', catalogPriceNet:9, useForQuote:true }] }]);
        const row = saved.find((item)=> item.id === 'store_price_1');
        H.assert(row && row.supplierId === 'local' && row.priceSource === 'Hurtownia lokalna', 'Aktywna cena nie ustawiła źródła ceny z dostawcy', row);
      })),
      H.makeTest('Akcesoria — store', 'Zapis akcesoriów dopisuje producenta do słownika producentów', 'Chroni pracę z nowym producentem dodanym przez katalog.', ()=> withSnapshot(()=>{
        const s = store();
        H.assert(s && s.savePriceList && s.getHardwareManufacturers, 'Brak API store');
        s.savePriceList('accessories', [{ id:'maker_1', manufacturer:'Nowy Producent Test', symbol:'NP-1', name:'Okucie producenta', hardwareCategory:'Zawiasy', hardwareUnit:'szt.' }]);
        H.assert(s.getHardwareManufacturers().includes('Nowy Producent Test'), 'Nowy producent nie trafił do słownika', s.getHardwareManufacturers());
      })),

      H.makeTest('Akcesoria — import/export', 'Eksport dostawców nie ma kolumny VAT', 'Chroni arkusz Dostawcy przed powrotem vat_domyslny_proc.', ()=>{
        const api = requireImport();
        H.assert(Array.isArray(api.SUPPLIER_COLUMNS), 'Brak SUPPLIER_COLUMNS');
        const headers = api.SUPPLIER_COLUMNS.map((pair)=> pair[0]);
        H.assert(headers.includes('rabat_domyslny_proc'), 'Arkusz dostawców nie ma rabatu', headers);
        H.assert(!headers.includes('vat_domyslny_proc'), 'Arkusz dostawców nadal ma VAT', headers);
      }),
      H.makeTest('Akcesoria — import/export', 'Ceny_dostawcow ma dane użytkowe z przodu i ID techniczne na końcu', 'Pilnuje, żeby Excel był ręcznie używalny bez szukania ID.', ()=>{
        const xlsx = requireSupplierXlsx();
        const headers = xlsx.SUPPLIER_PRICE_COLUMNS.map((pair)=> pair[0]);
        H.assert(headers.slice(0, 6).join('|') === 'okucie_nazwa|okucie_symbol|producent|kategoria|jednostka|dostawca', 'Początek arkusza cen nie jest użytkowy', headers);
        H.assert(headers[headers.length - 2] === 'okucie_id' && headers[headers.length - 1] === 'dostawca_id', 'ID techniczne nie są na końcu', headers);
      }),
      H.makeTest('Akcesoria — import/export', 'Arkusz Okucia eksportuje techniczne dane szuflad', 'Pilnuje pełnego katalogu pod listy zakupowe bez wypychania tych danych na główną listę programu.', ()=>{
        const api = requireImport();
        const headers = api.ACCESSORY_COLUMNS.map((pair)=> pair[0]);
        ['system_okucia','profil_szuflady','dlugosc_mm','nosnosc_kg','wzmocniona','kolor_okucia','zastosowanie'].forEach((name)=>{
          H.assert(headers.includes(name), 'Brak kolumny technicznej w arkuszu Okucia: ' + name, headers);
        });
      }),
      H.makeTest('Akcesoria — import/export', 'Import arkusza Okucia przenosi system i dane techniczne', 'Chroni masowe uzupełnianie katalogu z Excela przed zgubieniem danych szuflad.', ()=> withSnapshot(()=>{
        const s = store(), api = requireImport();
        s.savePriceList('accessories', []);
        s.saveHardwareManufacturers(['Blum']);
        s.saveHardwareSuppliers(suppliers());
        const data = api.parseWorkbook({
          Okucia:[
            ['nazwa','jednostka','producent','kategoria','system_okucia','typ_cecha','symbol','profil_szuflady','dlugosc_mm','nosnosc_kg','wzmocniona','kolor_okucia','zastosowanie'],
            ['Tandembox M 500 50kg','kpl.','Blum','Szuflady / prowadnice','Blum TANDEMBOX','M 500 50kg','TB-M500-50','M','500','50','TAK','biały','frontowa']
          ],
          Dostawcy:[['id','nazwa','rabat_domyslny_proc','aktywny'], ['mago','MAGO',0,'TAK']],
          Producenci:[['nazwa'], ['Blum']]
        });
        const plan = api.buildImportPlan(data, { mode:'merge' });
        const row = plan.next.accessories.find((item)=> item.symbol === 'TB-M500-50');
        H.assert(plan.errors.length === 0 && row, 'Nie utworzono pozycji technicznej z arkusza Okucia', plan);
        H.assert(row.hardwareSystem === 'Blum TANDEMBOX' && String(row.hardwareType || '').includes('M') && String(row.hardwareType || '').includes('500') && String(row.hardwareType || '').includes('50'), 'System/typ nie przeszły importu', row);
        H.assert(row.drawerProfile === 'M' && Number(row.drawerLengthMm) === 500 && Number(row.drawerLoadKg) === 50 && row.drawerReinforced === true, 'Dane techniczne szuflady nie przeszły importu', row);
      })),
      H.makeTest('Akcesoria — import/export', 'Ceny_dostawcow zostawia szybkie kolumny z przodu, a techniczne przed ID', 'Chroni wygodne hurtowe wklejanie cen: dane techniczne są opcjonalne i nie przesuwają dostawcy/ceny.', ()=>{
        const xlsx = requireSupplierXlsx();
        const headers = xlsx.SUPPLIER_PRICE_COLUMNS.map((pair)=> pair[0]);
        H.assert(headers.slice(0, 6).join('|') === 'okucie_nazwa|okucie_symbol|producent|kategoria|jednostka|dostawca', 'Szybkie kolumny cen nie są na początku', headers);
        H.assert(headers.includes('system_okucia') && headers.includes('dlugosc_mm') && headers.includes('nosnosc_kg'), 'Arkusz cen nie ma opcjonalnych danych technicznych', headers);
        H.assert(headers[headers.length - 2] === 'okucie_id' && headers[headers.length - 1] === 'dostawca_id', 'ID techniczne nie są na końcu', headers);
      }),
      H.makeTest('Akcesoria — import/export', 'Nowe okucie z arkusza cen zapisuje techniczne dane, jeśli są podane', 'Chroni szybki import cennika: nowa pozycja może od razu dostać system, długość, nośność i wzmocnienie.', ()=> withSnapshot(()=>{
        const s = store(), api = requireImport();
        s.savePriceList('accessories', []);
        s.saveHardwareManufacturers(['Rejs']);
        s.saveHardwareSuppliers([{ id:'local', name:'Hurtownia lokalna', defaultDiscountPercent:0, active:true }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{ defaultVatRate:23 }, supplierPriceRows:[{
          __rowIndex:24, producent:'Rejs', okucie_symbol:'RCB-M500-50', okucie_nazwa:'Comfort Box M 500 wzmocniona', kategoria:'Szuflady / prowadnice', jednostka:'kpl.', dostawca:'Hurtownia lokalna', cena_brutto:98,
          system_okucia:'Rejs Comfort Box', typ_cecha:'M 500 50kg', profil_szuflady:'M', dlugosc_mm:500, nosnosc_kg:50, wzmocniona:'TAK', kolor_okucia:'biały', zastosowanie:'frontowa'
        }] }, { mode:'merge' });
        const row = plan.next.accessories.find((item)=> item.symbol === 'RCB-M500-50');
        H.assert(row && plan.summary.supplierPriceCreatedAccessories === 1, 'Ceny_dostawcow nie utworzył nowego okucia technicznego', plan);
        H.assert(row.hardwareSystem === 'Rejs Comfort Box' && String(row.hardwareType || '').includes('M') && String(row.hardwareType || '').includes('500') && String(row.hardwareType || '').includes('50'), 'System/typ nie przeszły z arkusza cen', row);
        H.assert(Number(row.drawerLengthMm) === 500 && Number(row.drawerLoadKg) === 50 && row.drawerReinforced === true, 'Techniczne dane z arkusza cen nie przeszły do katalogu', row);
      })),

      H.makeTest('Akcesoria — import/export', 'Eksport pustych wierszy cen nie generuje formuł netto/brutto', 'Chroni przed powrotem zapętlonych formuł i #REF! po kopiowaniu linii.', ()=>{
        const xlsx = requireSupplierXlsx();
        H.assert(typeof xlsx.buildSupplierPriceRows === 'function', 'Brak buildSupplierPriceRows');
        const rows = xlsx.buildSupplierPriceRows([], suppliers(), { defaultVatRate:23 });
        const empty = rows[rows.length - 1] || [];
        H.assert(!empty.some((cell)=> cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'formula')), 'Pusty wiersz ma formułę', empty);
      }),
      H.makeTest('Akcesoria — import/export', 'Import po producent+symbol aktualizuje cenę, ale nie nadpisuje nazwy z katalogu', 'Chroni przypadek, gdy hurtownia ma inną nazwę tego samego symbolu.', ()=> withSnapshot(()=>{
        const s = store(), api = requireImport();
        H.assert(s && s.savePriceList && s.saveHardwareSuppliers, 'Brak API store');
        s.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, active:true }]);
        s.savePriceList('accessories', [{ id:'name_diff_hw', manufacturer:'Blum', symbol:'ND-1', name:'Nazwa katalogowa', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, useForQuote:true, priceDate:'2026-05-12' }] }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{ defaultVatRate:23 }, supplierPriceRows:[{ __rowIndex:8, producent:'Blum', okucie_symbol:'ND-1', okucie_nazwa:'Inna nazwa z cennika', dostawca:'MAGO', cena_netto:15, data_ceny:'2026-05-13' }] }, { mode:'merge' });
        const row = plan.next.accessories.find((item)=> item.id === 'name_diff_hw');
        const price = row && row.supplierPrices.find((item)=> item.supplierId === 'mago');
        H.assert(row && row.name === 'Nazwa katalogowa', 'Nazwa katalogowa została nadpisana nazwą z cen dostawców', row);
        H.assert(plan.summary.supplierPricesUpdated === 1 && price && price.catalogPriceNet === 15, 'Cena nie została zaktualizowana po producent+symbol', { summary:plan.summary, row });
      })),
      H.makeTest('Akcesoria — import/export', 'Podgląd importu nie mutuje katalogu przed zatwierdzeniem', 'Pilnuje stabilizacji importu: buildImportPlan ma być planem, nie zapisem.', ()=> withSnapshot(()=>{
        const s = store(), api = requireImport();
        s.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, active:true }]);
        s.savePriceList('accessories', [{ id:'pure_hw_browser', manufacturer:'Blum', symbol:'PURE-B', name:'Czystość planu', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, useForQuote:true, priceDate:'2026-05-12' }] }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{ defaultVatRate:23 }, supplierPriceRows:[{ __rowIndex:9, producent:'Blum', okucie_symbol:'PURE-B', dostawca:'MAGO', cena_netto:11, data_ceny:'2026-05-13' }] }, { mode:'merge' });
        const stored = s.getAccessories().find((item)=> item.id === 'pure_hw_browser');
        const storedPrice = stored && stored.supplierPrices[0];
        const planned = plan.next.accessories.find((item)=> item.id === 'pure_hw_browser');
        H.assert(storedPrice && storedPrice.catalogPriceNet === 10, 'buildImportPlan zmienił cenę w store przed zatwierdzeniem', stored);
        H.assert(planned && planned.supplierPrices[0].catalogPriceNet === 11, 'Plan importu nie zawiera nowej ceny', planned);
      })),
      H.makeTest('Akcesoria — import/export', 'Pominięcie ceny przez resolver nie zapisuje ceny', 'Chroni Ignoruj i Ignoruj wszystko przy brakującym dostawcy.', ()=> withSnapshot(()=>{
        const s = store(), api = requireImport();
        s.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, active:true }]);
        s.savePriceList('accessories', [{ id:'skip_hw_1', manufacturer:'Blum', symbol:'SKIP-1', name:'Pomiń cenę', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', supplierPrices:[] }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{}, supplierPriceRows:[{ __rowIndex:12, producent:'Blum', okucie_symbol:'SKIP-1', cena_netto:12, __skipImport:true }] }, { mode:'merge' });
        const row = plan.next.accessories.find((item)=> item.id === 'skip_hw_1');
        H.assert(plan.summary.supplierPricesSkipped === 1, 'Pominięta cena nie została policzona jako skipped', plan.summary);
        H.assert(row && (!Array.isArray(row.supplierPrices) || row.supplierPrices.length === 0), 'Pominięta cena mimo wszystko została dodana', row);
      })),
      H.makeTest('Akcesoria — import/export', 'Brak dostawcy przy istniejącym okuciu trafia do resolvera', 'Chroni modal wyboru dostawcy dla ceny, która pasuje po producent+symbol.', ()=>{
        const xlsx = requireSupplierXlsx();
        const gaps = xlsx.supplierPriceMissingSupplierGaps([
          { __rowIndex:15, producent:'Blum', okucie_symbol:'SUP-MISS', cena_netto:12 }
        ], [{ id:'sup_miss_hw', manufacturer:'Blum', symbol:'SUP-MISS', name:'Brak dostawcy', hardwareCategory:'Zawiasy', hardwareUnit:'szt.' }], suppliers());
        H.assert(gaps.length === 1 && gaps[0].gaps.includes('supplierName'), 'Brak dostawcy nie trafił do resolvera', gaps);
      }),
      H.makeTest('Akcesoria — import/export', 'Nowe okucie z arkusza cen wymaga kategorii i jednostki', 'Chroni przed automatycznym wrzucaniem Inne/szt. bez decyzji użytkownika.', ()=>{
        const xlsx = requireSupplierXlsx();
        const gaps = xlsx.supplierPriceCreateRequiredGaps([
          { __rowIndex:16, producent:'Blum', okucie_symbol:'NEW-GAP', okucie_nazwa:'Nowe z brakiem', dostawca:'MAGO', cena_netto:10 }
        ], [], suppliers(), ['Blum']);
        H.assert(gaps.length === 1 && gaps[0].gaps.includes('itemCategory') && gaps[0].gaps.includes('itemUnit'), 'Brak kategorii/jednostki nie wymaga resolvera', gaps);
      }),
      H.makeTest('Akcesoria — import/export', 'Nowe okucie z arkusza cen nie tworzy producenta z literówki', 'Chroni słownik producentów przed śmieciami z hurtowego cennika.', ()=> withSnapshot(()=>{
        const s = store(), api = requireImport();
        s.savePriceList('accessories', []);
        s.saveHardwareManufacturers(['Blum']);
        s.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, active:true }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{}, supplierPriceRows:[{ __rowIndex:17, producent:'Bluum', okucie_symbol:'TYPO-1', okucie_nazwa:'Literówka producenta', kategoria:'Zawiasy', jednostka:'szt.', dostawca:'MAGO', cena_netto:10 }] }, { mode:'merge' });
        H.assert(plan.summary.supplierPriceCreatedAccessories === 0 && plan.warnings.some((msg)=> text(msg).includes('producenta spoza słownika')), 'Literówka producenta utworzyła nowe okucie', plan);
      })),
      H.makeTest('Akcesoria — import/export', 'To samo okucie z katalogu i arkusza nie blokuje resolvera dostawcy', 'Chroni realny eksport/import, gdzie ten sam rekord występuje jako aktualny katalog i w arkuszu Okucia.', ()=>{
        const xlsx = requireSupplierXlsx();
        const existing = { id:'same_hw_1', manufacturer:'GTV', symbol:'FCHC 110° + euro', name:'Zawias GTV', hardwareCategory:'Zawiasy', hardwareUnit:'kpl.' };
        const importedSame = Object.assign({}, existing);
        const gaps = xlsx.supplierPriceMissingSupplierGaps([
          { __rowIndex:22, okucie_nazwa:'14', okucie_symbol:'FCHC 110° + euro', producent:'GTV', dostawca:'14', cena_netto:65, okucie_id:'14', dostawca_id:'14' }
        ], [existing, importedSame], [{ id:'local', name:'Hurtownia lokalna', defaultDiscountPercent:0, active:true }]);
        H.assert(gaps.length === 1 && gaps[0].item && gaps[0].item.id === 'same_hw_1', 'Fałszywy duplikat zablokował resolver dostawcy', gaps);
      }),
      H.makeTest('Akcesoria — import/export', 'Zapis planu importu zapisuje dopiero zaakceptowany plan', 'Chroni finalny etap applyImportPlan po potwierdzeniach cen.', ()=> withSnapshot(()=>{
        const s = store(), api = requireImport();
        s.saveHardwareSuppliers([{ id:'mago', name:'MAGO', defaultDiscountPercent:0, active:true }]);
        s.savePriceList('accessories', [{ id:'apply_hw_1', manufacturer:'Blum', symbol:'APPLY-1', name:'Apply test', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', supplierPrices:[{ supplierId:'mago', catalogPriceNet:10, catalogPriceGross:12.3, useForQuote:true }] }]);
        const plan = api.buildImportPlan({ accessories:[], suppliers:[], settings:{ defaultVatRate:23 }, supplierPriceRows:[{ __rowIndex:18, producent:'Blum', okucie_symbol:'APPLY-1', dostawca:'MAGO', cena_netto:12, data_ceny:'2026-05-13' }] }, { mode:'merge' });
        api.applyImportPlan(plan);
        const stored = s.getAccessories().find((item)=> item.id === 'apply_hw_1');
        H.assert(stored && stored.supplierPrices[0].catalogPriceNet === 12, 'applyImportPlan nie zapisał zaakceptowanej ceny', stored);
      })),

      H.makeTest('Akcesoria — architektura', 'Import/export okuć jest rozdzielony na parser, plan i eksport', 'Chroni refaktor: fasada zostaje publicznym API, ale ciężkie odpowiedzialności nie wracają do jednego pliku.', ()=>{
        const api = requireImport();
        H.assert(FC.hardwareCatalogExportXlsx && typeof FC.hardwareCatalogExportXlsx.exportXlsx === 'function', 'Brak modułu eksportu XLSX');
        H.assert(FC.hardwareCatalogImportParser && typeof FC.hardwareCatalogImportParser.parseWorkbook === 'function', 'Brak modułu parsera importu');
        H.assert(FC.hardwareCatalogImportPlan && typeof FC.hardwareCatalogImportPlan.buildImportPlan === 'function', 'Brak modułu planu importu');
        H.assert(api.exportXlsx === FC.hardwareCatalogExportXlsx.exportXlsx, 'Fasada nie deleguje eksportu XLSX');
        H.assert(api.parseWorkbook === FC.hardwareCatalogImportParser.parseWorkbook, 'Fasada nie deleguje parsera XLSX');
        H.assert(api.buildImportPlan === FC.hardwareCatalogImportPlan.buildImportPlan, 'Fasada nie deleguje planu importu');
      }),
      H.makeTest('Akcesoria — architektura', 'Ceny dostawców mają osobny eksport i import pod fasadą XLSX', 'Chroni arkusz Ceny_dostawcow przed powrotem parsera, matchingu i eksportu do jednego pliku.', ()=>{
        const xlsx = requireSupplierXlsx();
        H.assert(FC.hardwareSupplierPriceExport && typeof FC.hardwareSupplierPriceExport.buildSupplierPriceRows === 'function', 'Brak modułu eksportu cen dostawców');
        H.assert(FC.hardwareSupplierPriceImport && typeof FC.hardwareSupplierPriceImport.applySupplierPriceRows === 'function', 'Brak modułu importu cen dostawców');
        H.assert(xlsx.buildSupplierPriceRows === FC.hardwareSupplierPriceExport.buildSupplierPriceRows, 'Fasada cen nie deleguje eksportu');
        H.assert(xlsx.applySupplierPriceRows === FC.hardwareSupplierPriceImport.applySupplierPriceRows, 'Fasada cen nie deleguje importu');
        H.assert(typeof xlsx.supplierPriceMissingSupplierGaps === 'function' && typeof xlsx.supplierPriceCreateRequiredGaps === 'function', 'Fasada cen straciła resolvery braków');
      }),

      H.makeTest('Akcesoria — UI kontrakty', 'Status ceny rozróżnia brak, do sprawdzenia, starą i aktualną cenę', 'Chroni czytelne chipy statusu na liście okuć.', ()=>{
        const ctx = FC.priceModalContext || {};
        H.assert(typeof ctx.hardwarePriceStatus === 'function', 'Brak hardwarePriceStatus');
        H.assert(ctx.hardwarePriceStatus({}).code === 'noPrice', 'Brak ceny nie jest noPrice');
        H.assert(ctx.hardwarePriceStatus({ price:10, priceStatus:'review' }).code === 'check', 'review nie jest Do sprawdzenia');
        H.assert(ctx.hardwarePriceStatus({ price:10, priceStatus:'old' }).code === 'stale', 'old nie jest starą ceną');
        H.assert(ctx.hardwarePriceStatus({ price:10, priceStatus:'current' }).code === 'current', 'current nie jest aktualny');
      }),
      H.makeTest('Akcesoria — UI kontrakty', 'Szybkie filtry rozpoznają brak ceny, starą cenę i zestawy', 'Chroni filtr Do sprawdzenia cen / Brak ceny / Zestawy.', ()=>{
        const ctx = FC.priceModalContext || {};
        H.assert(typeof ctx.matchesHardwareQuickFilter === 'function', 'Brak matchesHardwareQuickFilter');
        const prev = ctx.runtimeState && ctx.runtimeState.filters ? Object.assign({}, ctx.runtimeState.filters) : {};
        ctx.runtimeState = ctx.runtimeState || {};
        try{
          ctx.runtimeState.filters = { hardwareQuickFilter:'noPrice' };
          H.assert(ctx.matchesHardwareQuickFilter({ name:'Bez ceny' }) === true, 'Filtr brak ceny nie łapie braku ceny');
          ctx.runtimeState.filters = { hardwareQuickFilter:'bundles' };
          H.assert(ctx.matchesHardwareQuickFilter({ hardwareUnit:'zestaw', price:10 }) === true, 'Filtr zestawów nie łapie jednostki zestaw');
          ctx.runtimeState.filters = { hardwareQuickFilter:'stale' };
          H.assert(ctx.matchesHardwareQuickFilter({ price:10, priceStatus:'old' }) === true, 'Filtr starej ceny nie łapie old');
        }finally{
          ctx.runtimeState.filters = prev;
        }
      }),
      H.makeTest('Akcesoria — UI kontrakty', 'Picker typu/cechy pokazuje pusty wybór jako prawdziwie pusty', 'Chroni błąd, gdzie pusty typ wyglądał jak domyślnie wybrany.', ()=> withSnapshot(()=>{
        const s = store();
        const ctx = FC.priceModalContext || {};
        H.assert(s && s.saveHardwareTypes && typeof ctx.buildHardwareTypeOptions === 'function', 'Brak API typów w UI');
        s.saveHardwareTypes([{ id:'ui_type', name:'110st test', allowedCategories:['Zawiasy'], active:true }]);
        const opts = ctx.buildHardwareTypeOptions('Zawiasy', '', { manufacturer:'Blum', currentId:'new_hw' });
        H.assert(opts[0] && opts[0].value === '', 'Pierwsza opcja nie jest pustym wyborem', opts);
      })),
      H.makeTest('Akcesoria — UI kontrakty', 'Potwierdzenia importu cen mają osobny moduł', 'Chroni przed cichym dodawaniem i aktualizacją cen dostawców.', ()=>{
        const api = FC.priceModalHardwarePriceConfirm;
        H.assert(api && typeof api.confirmSupplierPriceChanges === 'function', 'Brak modułu potwierdzania zmian cen');
      }),
      H.makeTest('Akcesoria — UI kontrakty', 'Resolver importu nie jest miejscem tworzenia nowych dostawców', 'Chroni przed literówkami w dostawcach podczas importu cen.', ()=>{
        const resolver = FC.priceModalHardwareImportResolver;
        H.assert(resolver && typeof resolver.resolveMissingRequired === 'function', 'Brak resolvera importu');
      }),
      H.makeTest('Akcesoria — UI kontrakty', 'Wiersz okucia renderuje niski przycisk Edytuj w linii statusu', 'Chroni ostatnią zmianę UX karty okucia.', ()=>{
        const ctx = FC.priceModalContext || {};
        H.assert(typeof ctx.renderHardwareAccessoryRow === 'function', 'Brak renderHardwareAccessoryRow');
        const row = ctx.renderHardwareAccessoryRow({ name:'Test UI', manufacturer:'Blum', hardwareCategory:'Zawiasy', hardwareUnit:'szt.', price:10, priceStatus:'current' }, ()=>{});
        H.assert(row && row.querySelector && row.querySelector('.hardware-price-row__status-actions .hardware-price-row__edit-btn'), 'Brak przycisku Edytuj w linii statusu', row && row.outerHTML);
      }),
    ];
  }

  FC.materialAccessoryTests = { collectTests };
})(typeof window !== 'undefined' ? window : globalThis);
